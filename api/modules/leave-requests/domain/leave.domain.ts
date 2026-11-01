import { withLockedTransaction, withMysqlTransaction } from '../../../db/mysql';
import { badRequest, notFound } from '../../../shared/errors';
import { makeVerifyCode } from '../../../shared/verify';
import {
  getLeaveTypeRule,
  knownLeaveTypes,
  LEAVE_TYPE_RULES,
  validateLeaveTypeRules,
} from './leave-types';
import {
  ANNUAL_LEAVE,
  detectDurationAnomaly,
  formatMasaKerja,
  isLeaveTypeAllowedForNip,
  isPppkNip,
} from './quota-engine';
import {
  deleteLeaveRequest,
  insertAuditLog,
  insertLeaveRequest,
  updateLeaveRequest,
} from '../command';
import {
  countLeaveRequests,
  countLeaveRequestsGrouped,
  countLeaveArchiveBuckets,
  countApprovalSummary,
  findClosurePeriods,
  findInstanceProfile,
  findLeavePolicyByYear,
  findLeaveQuotaAudits,
  findLeaveRequestById,
  findLeaveRequests,
  findLeaveLegacyHistory,
  findStoredQuotasByUser,
  findUserNipById,
  findUserProfileById,
  countLeaveRequestsByYear,
  queryApproverSuggestions,
} from '../query';
import { checkAvailability, getQuota, rebuildQuota, toDateOnly } from './quota.domain';

/**
 * Service cuti — aturan bisnis + orkestrasi permohonan. Tidak ada SQL di file ini.
 */

export type CreateLeaveInput = {
  user_id: number;
  leave_type: string;
  duration: number;
  duration_unit?: 'day' | 'month' | 'year';
  start_date: string;
  end_date: string;
  reason?: string;
  address?: string;
  phone?: string;
  approver_1_name?: string;
  approver_1_nip?: string;
  approver_1_position?: string;
  approver_2_name?: string;
  approver_2_nip?: string;
  approver_2_position?: string;
  /** Berkas lampiran opsional (dipakai endpoint multipart). */
  attachment?: { buffer: Buffer; filename: string; mimeType?: string | null };
};

const yearOf = (value: string | Date): number => Number(String(value).slice(0, 4));

/**
 * Periode tutup cuti tahunan dibaca dari tabel, bukan hard-code.
 * `date` opsional supaya pengajuan pada tanggal tertentu bisa diuji tanpa
 * bergantung tanggal sistem.
 */
export const isAnnualLeaveClosed = async (
  startDate: string,
  endDate: string,
  date?: string,
): Promise<{ closed: boolean; message: string | null }> => {
  const periods = await findClosurePeriods();
  const start = toDateOnly(startDate);
  const end = toDateOnly(endDate);
  const today = toDateOnly(date ?? new Date());
  for (const period of periods) {
    const periodStart = toDateOnly(period.start_date);
    const periodEnd = toDateOnly(period.end_date);
    const overlap = start <= periodEnd && end >= periodStart;
    const todayWithin = today >= periodStart && today <= periodEnd;
    if (overlap && todayWithin) {
      return { closed: true, message: period.message };
    }
  }
  return { closed: false, message: null };
};

export const listLeaveRequests = async (filter: {
  userId?: number;
  leaveType?: string;
  status?: string;
  adminDecision?: string;
  approverLevel?: 1 | 2;
  approverStatus?: 'pending' | 'accepted' | 'rejected';
  approverNip?: string;
  year?: number;
  search?: string;
  letterStatus?: 'with' | 'without';
  fileStatus?: 'with' | 'without';
  archive?: 'all' | 'belum_diperiksa' | 'belum_kirim' | 'sk_belum_upload' | 'cuti_jadi' | 'ditolak' | 'dibatalkan';
  page?: number;
  perPage?: number;
}) => {
  const perPage = Math.min(Math.max(filter.perPage ?? 25, 1), 200);
  const page = Math.max(filter.page ?? 1, 1);
  const [items, total] = await Promise.all([
    findLeaveRequests({ ...filter, limit: perPage, offset: (page - 1) * perPage }),
    countLeaveRequests(filter),
  ]);
  return {
    items,
    total,
    page,
    per_page: perPage,
    total_pages: Math.ceil(total / perPage),
  };
};

/** Rekap antrean persetujuan berjenjang (Semua Menunggu, Atasan 1, Atasan 2, Admin, Cuti Jadi). */
export const getApprovalSummary = async (filter: { approverNip?: string } = {}) => {
  return countApprovalSummary(filter);
};

/** Ringkasan arsip: jumlah per status, per jenis cuti, dan bucket operasional legacy. */
export const getLeaveStatistics = async (filter: { userId?: number; year?: number } = {}) => {
  const [byStatus, byType, byArchive] = await Promise.all([
    countLeaveRequestsGrouped('status', filter),
    countLeaveRequestsGrouped('leave_type', filter),
    countLeaveArchiveBuckets(filter),
  ]);
  return { by_status: byStatus, by_type: byType, by_archive: byArchive };
};

/** Rekap tahunan (dasbor admin) — legacy `admin.php:240-265`. */
export const getLeaveYearlySummary = async () => {
  const rows = await countLeaveRequestsByYear();
  return rows.map((row) => ({
    year: Number(row.year),
    submitted: Number(row.submitted ?? 0),
    approved: Number(row.approved ?? 0),
    rejected: Number(row.rejected ?? 0),
    cancelled: Number(row.cancelled ?? 0),
    total: Number(row.total ?? 0),
  }));
};

/** Riwayat cuti pra-2020 hasil migrasi; dibatasi ke pemiliknya untuk pegawai. */
export const getLeaveLegacyHistory = async (filter: {
  userId?: number;
  year?: number;
}) => findLeaveLegacyHistory(filter);

export const getLeaveRequestDetail = async (id: number) => {
  const request = await findLeaveRequestById(id);
  if (!request) throw notFound('Permohonan cuti tidak ditemukan');

  // Surat keterangan dan lampiran ikut dikirim supaya halaman detail tidak
  // perlu memanggil tiga endpoint terpisah.
  const { listByEntity } = await import('../../documents/domain');
  const { findLeaveLetterByRequest } = await import('../query');
  const [letters, attachments, instance] = await Promise.all([
    findLeaveLetterByRequest(id),
    listByEntity('leave_requests', id),
    findInstanceProfile(),
  ]);
  const formattedServiceYears = formatMasaKerja(request.service_years, request.nip, request.start_date);
  return {
    ...request,
    service_years: formattedServiceYears,
    letters,
    attachments,
    instance,
    verify_code: makeVerifyCode('leave_requests', id),
  };
};

/** Data cetak buku cuti satu pegawai (projection + identitas + kop instansi). */
export const getQuotaBookPrint = async (userId: number) => {
  const [user, stored, instance] = await Promise.all([
    findUserProfileById(userId),
    findStoredQuotasByUser(userId),
    findInstanceProfile(),
  ]);
  if (!user) throw notFound('Pegawai tidak ditemukan');
  return { user, stored, instance };
};

// ---------------------------------------------------------------------------
// Pembungkus untuk route — nama di sini yang dipakai `leave.routes.ts`.
// ---------------------------------------------------------------------------

/** Saldo kuota dalam bentuk yang dipakai UI (camelCase + angka hari). */
export const getQuotaSummary = async (userId: number, year: number) => {
  try {
    const quota = await getQuota(userId, year);
    return {
      year: quota.year,
      official: quota.official,
      reservedDays: quota.reservedDays,
      reservedCount: quota.reservedCount,
      available: quota.available,
      eligibility: quota.eligibility,
    };
  } catch {
    return {
      year,
      official: { n: 12, n1: 0, n2: 0, total: 12 },
      reservedDays: 0,
      reservedCount: 0,
      available: { n: 12, n1: 0, n2: 0, total: 12 },
      eligibility: {
        eligible: true,
        reason: 'Memenuhi syarat',
        monthsWorked: 12,
        tmtYear: null,
        tmtMonth: null,
        isPppk: false,
        manualValidation: false,
        eligibleDate: null,
      },
    };
  }
};

export const getPolicy = async (year: number) => findLeavePolicyByYear(year);

export const getQuotaHistory = async (userId: number, year?: number) =>
  findLeaveQuotaAudits(userId, year);

export const getStoredQuotas = async (userId: number) => findStoredQuotasByUser(userId);

export const rebuildUserQuota = async (userId: number, year: number, actorId?: number | null) =>
  rebuildQuota(userId, year, actorId ?? null);

/** Jenis cuti yang boleh diajukan pegawai ini, lengkap dengan aturannya. */
export const getLeaveTypeOptions = async (userId: number) => {
  const nip = await findUserNipById(userId);
  const isPppk = nip ? isPppkNip(nip) : false;
  const allowed = nip ? knownLeaveTypes().filter((t) => isLeaveTypeAllowedForNip(nip, t)) : [];
  return {
    is_pppk: isPppk,
    types: allowed.map((type) => {
      const rule = LEAVE_TYPE_RULES[type];
      return {
        name: type,
        units: rule?.units ?? ['day'],
        max_days: rule?.maxDays ?? 0,
        consumes_quota: rule?.consumesQuota ?? false,
        requires_attachment: rule?.requiresAttachment ?? false,
        subject_to_closure: rule?.subjectToClosure ?? false,
        description: rule?.description ?? '',
      };
    }),
  };
};

/**
 * Buat permohonan dengan validasi server-side + reservasi kuota yang aman.
 *
 * Kunci per user+tahun diambil SEBELUM kuota dibaca. Tanpa ini dua permohonan
 * yang masuk bersamaan membaca saldo yang sama dan keduanya lolos validasi —
 * saldo bisa minus (terbukti: 8 permohonan serentak → reserved 26 dari jatah 24).
 */
export const createLeaveRequest = async (input: CreateLeaveInput) => {
  const nip = await findUserNipById(input.user_id);
  if (!nip) throw badRequest('User tidak memiliki NIP, tidak dapat mengajukan cuti');

  const isPppk = isPppkNip(nip);
  const durationUnit = input.duration_unit ?? 'day';

  const typeCheck = validateLeaveTypeRules(input.leave_type, input.duration, durationUnit, isPppk);
  if (!typeCheck.valid) throw badRequest(typeCheck.message);

  if (!isLeaveTypeAllowedForNip(nip, input.leave_type)) {
    throw badRequest('Jenis cuti tidak diizinkan untuk pegawai ini (aturan PPPK)');
  }

  const rule = getLeaveTypeRule(input.leave_type);
  if (rule?.requiresAttachment && !input.attachment) {
    throw badRequest(`${input.leave_type} wajib melampirkan dokumen pendukung`);
  }

  const anomaly = detectDurationAnomaly(input.duration, durationUnit, input.leave_type);
  if (anomaly === 'durasi_tidak_valid') {
    throw badRequest('Lama cuti harus lebih dari 0');
  }

  const year = yearOf(input.start_date);

  if (input.leave_type === ANNUAL_LEAVE) {
    const closure = await isAnnualLeaveClosed(input.start_date, input.end_date);
    if (closure.closed) {
      throw badRequest(closure.message ?? 'Permohonan cuti tahunan sedang ditutup');
    }
  }

  const id = await withLockedTransaction(`leave:${input.user_id}:${year}`, async (connection) => {
    // Kuota dinilai lewat koneksi transaksi supaya snapshot-nya diambil
    // setelah kunci didapat.
    const availability = await checkAvailability(
      input.user_id,
      year,
      input.duration,
      input.leave_type,
      null,
      connection,
    );
    if (!availability.valid) throw badRequest(availability.message);

    const profile = await findUserProfileById(input.user_id, connection);
    const serviceYears = formatMasaKerja(null, nip, input.start_date);
    return insertLeaveRequest(
      {
        user_id: input.user_id,
        name: profile?.name ?? '',
        nip,
        grade: profile?.grade ?? null,
        position: profile?.position_name ?? null,
        organization_name: profile?.organization_name ?? profile?.unit_name ?? null,
        service_years: serviceYears !== '-' ? serviceYears : null,
        leave_type: input.leave_type,
        duration: input.duration,
        duration_unit: durationUnit,
        start_date: input.start_date,
        end_date: input.end_date,
        reason: input.reason ?? null,
        address: input.address ?? null,
        phone: input.phone ?? null,
        approver_1_name: input.approver_1_name ?? null,
        approver_1_nip: input.approver_1_nip ?? null,
        approver_1_position: input.approver_1_position ?? null,
        approver_2_name: input.approver_2_name ?? null,
        approver_2_nip: input.approver_2_nip ?? null,
        approver_2_position: input.approver_2_position ?? null,
        anomaly_flag: anomaly,
      },
      connection,
    );
  });

  // Lampiran diunggah setelah transaksi supaya kegagalan MinIO tidak
  // menggagalkan permohonan yang sudah lolos validasi kuota.
  //
  // Pengecualian: kalau jenis cuti ini WAJIB lampiran, permohonan tanpa bukti
  // tidak boleh tertinggal di database. Dalam hal itu unggahan dibalik — baris
  // permohonan dihapus lagi — supaya tidak ada permohonan wajib-bukti yang
  // lolos tanpa berkas.
  let attachmentId: number | null = null;
  if (input.attachment) {
    const { uploadDocument } = await import('../../documents/domain');
    try {
      const uploaded = await uploadDocument({
        buffer: input.attachment.buffer,
        filename: input.attachment.filename,
        mimeType: input.attachment.mimeType ?? null,
        entityTable: 'leave_requests',
        entityId: id,
        field: 'attachment',
        label: 'Lampiran permohonan',
        actorId: input.user_id,
      });
      attachmentId = uploaded.id;
    } catch (error) {
      if (rule?.requiresAttachment) {
        await deleteLeaveRequest(id).catch(() => undefined);
        throw error;
      }
      // Jenis cuti tanpa kewajiban lampiran: permohonan tetap berlaku, berkas
      // bisa menyusul lewat endpoint dokumen.
      const { logger } = await import('../../../shared/logger');
      logger.warn('leave-attachment-failed', `permohonan ${id}: ${(error as Error).message}`);
    }
  }

  await rebuildQuota(input.user_id, year, input.user_id);
  return { id, attachment_id: attachmentId };
};

export const updateLeaveRequestById = async (
  id: number,
  input: Partial<CreateLeaveInput>,
) => {
  const existing = await findLeaveRequestById(id);
  if (!existing) throw notFound('Permohonan cuti tidak ditemukan');

  if (existing.status === 'approved') {
    throw badRequest('Permohonan yang sudah final tidak dapat diubah');
  }

  const duration = input.duration ?? existing.duration;
  const leaveType = input.leave_type ?? existing.leave_type;
  const durationUnit = input.duration_unit ?? (existing.duration_unit as 'day' | 'month' | 'year');
  const startDate = input.start_date ?? toDateOnly(existing.start_date);
  const endDate = input.end_date ?? toDateOnly(existing.end_date);
  const year = yearOf(startDate);

  const nip = await findUserNipById(existing.user_id);
  const typeCheck = validateLeaveTypeRules(leaveType, duration, durationUnit, nip ? isPppkNip(nip) : false);
  if (!typeCheck.valid) throw badRequest(typeCheck.message);

  if (leaveType === ANNUAL_LEAVE) {
    const closure = await isAnnualLeaveClosed(startDate, endDate);
    if (closure.closed) {
      throw badRequest(closure.message ?? 'Permohonan cuti tahunan sedang ditutup');
    }
  }

  await withLockedTransaction(`leave:${existing.user_id}:${year}`, async (connection) => {
    // `id` dikecualikan supaya permohonan yang sedang diedit tidak dihitung dua kali.
    const availability = await checkAvailability(
      existing.user_id,
      year,
      duration,
      leaveType,
      id,
      connection,
    );
    if (!availability.valid) throw badRequest(availability.message);

    await updateLeaveRequest(
      id,
      {
        ...(input.leave_type ? { leave_type: input.leave_type } : {}),
        ...(input.duration ? { duration: input.duration } : {}),
        ...(input.duration_unit ? { duration_unit: input.duration_unit } : {}),
        ...(input.start_date ? { start_date: input.start_date } : {}),
        ...(input.end_date ? { end_date: input.end_date } : {}),
        ...(input.reason !== undefined ? { reason: input.reason } : {}),
        ...(input.address !== undefined ? { address: input.address } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
      },
      connection,
    );
  });

  await rebuildQuota(existing.user_id, year, existing.user_id);
  return { id };
};

export const removeLeaveRequest = async (id: number) => {
  const existing = await findLeaveRequestById(id);
  if (!existing) throw notFound('Permohonan cuti tidak ditemukan');
  if (existing.status === 'approved') {
    throw badRequest('Permohonan final tidak boleh dihapus; gunakan pembatalan');
  }
  const userId = existing.user_id;
  const year = yearOf(existing.start_date);
  await withMysqlTransaction(async (connection) => {
    await deleteLeaveRequest(id, connection);
  });
  await rebuildQuota(userId, year, userId);
};

/** NIP user yang sedang login; dipakai untuk mencocokkan penunjukan atasan. */
export const getActorNip = async (userId: number): Promise<string | null> =>
  findUserNipById(userId);

/** Pegawai hanya boleh melihat permohonannya sendiri; atasan/verifikator/admin semua. */
export const canViewRequest = (
  actor: { id: number | string; role: string },
  request: { user_id: number },
): boolean =>
  actor.role === 'admin' ||
  actor.role === 'verifikator' ||
  actor.role === 'atasan' ||
  Number(actor.id) === Number(request.user_id);

export const canEditRequest = canViewRequest;

export const getApproverSuggestions = async (search?: string) => {
  const list = await queryApproverSuggestions({ search });
  return list.map((item) => ({
    id: item.id,
    name: item.name,
    nip: item.nip ?? '',
    position: item.position ?? item.unit_name ?? '',
    role: item.role,
  }));
};
