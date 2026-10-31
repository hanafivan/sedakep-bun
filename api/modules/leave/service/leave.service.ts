import { withLockedTransaction, withMysqlTransaction } from '../../../db/mysql';
import { badRequest, forbidden, notFound } from '../../../shared/errors';
import { makeVerifyCode } from '../../../shared/verify';
import {
  getLeaveTypeRule,
  knownLeaveTypes,
  LEAVE_TYPE_RULES,
  validateLeaveTypeRules,
} from '../domain/leave-types';
import {
  ANNUAL_LEAVE,
  detectDurationAnomaly,
  isLeaveTypeAllowedForNip,
  isPppkNip,
} from '../domain/quota-engine';
import {
  deleteLeaveRequest,
  insertAuditLog,
  insertLeaveRequest,
  updateLeaveDecision,
  updateLeaveRequest,
} from '../command';
import {
  countLeaveRequests,
  countLeaveRequestsGrouped,
  countLeaveArchiveBuckets,
  findClosurePeriods,
  findInstanceProfile,
  findLeavePolicyByYear,
  findLeaveQuotaAudits,
  findLeaveRequestById,
  findLeaveRequests,
  findLeaveLegacyHistory,
  findLeaveRequestsForExport,
  findStoredQuotasByUser,
  findUserNipById,
  findUserProfileById,
  countLeaveRequestsByYear,
} from '../query';
import { checkAvailability, getQuota, rebuildQuota, toDateOnly } from './quota.service';
import type { LeaveRequestRow } from '../schema/types';

/**
 * Service cuti — aturan bisnis + orkestrasi. Tidak ada SQL di file ini.
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

// ---------------------------------------------------------------------------
// Ekspor permohonan (CSV)
// ---------------------------------------------------------------------------

const CSV_HEADERS = [
  'No', 'Nama', 'NIP', 'Gol', 'Jabatan', 'Unit Kerja', 'Jenis Cuti', 'Alasan',
  'Lama', 'Satuan', 'Tgl Mulai', 'Tgl Selesai', 'Tgl Dibuat',
  'Status Pengajuan', 'Acc Atasan #1', 'Acc Atasan #2', 'Keterangan SK',
] as const;

const csvCell = (value: unknown): string => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** Label status permohonan seperti yang dibaca admin di legacy. */
const statusLabel = (row: Record<string, unknown>): string => {
  switch (row.status) {
    case 'approved': return 'Diterima';
    case 'rejected': return 'Ditolak';
    case 'cancelled': return 'Dibatalkan';
    default: return 'Belum diperiksa';
  }
};

const decisionLabel = (value: unknown, level: number): string => {
  if (value === 'accepted') return 'Diterima';
  if (value === 'rejected') return 'Ditolak';
  if (value === 'cancelled') return 'Dibatalkan';
  return `Belum Acc #${level}`;
};

/**
 * Keterangan kolom SK, mengikuti kalimat legacy di `transaksi_surat_masuk.php`.
 * Baris yang belum final tidak dihitung "belum ada SK" karena SK baru relevan
 * setelah permohonan diterima.
 */
const skNote = (row: Record<string, unknown>): string => {
  const status = statusLabel(row);
  if (status === 'Belum diperiksa') return 'Menunggu pengajuan diterima';
  if (status === 'Ditolak') {
    return row.rejection_reason ? `Pengajuan ditolak - ${row.rejection_reason}` : 'Pengajuan ditolak';
  }
  if (status === 'Dibatalkan') {
    return row.rejection_reason ? `Pengajuan dibatalkan - ${row.rejection_reason}` : 'Pengajuan dibatalkan';
  }
  const number = String(row.letter_number ?? '').trim();
  if (!number) return 'Belum diberi nomor SK';
  const numberOnly = number.split('/')[0] ?? '';
  const issued = row.letter_issued_at ? toDateOnly(row.letter_issued_at) : '';
  const month = issued ? issued.slice(5, 7) : '';
  const year = issued ? issued.slice(0, 4) : '';
  return `Nomor SK sudah ada, file SK belum diunggah: B-${numberOnly}/Kk.12.04/1/Kp.08.2/${month}/${year}`;
};

/**
 * Ekspor permohonan cuti sebagai CSV (legacy: unduhan `.xls` super admin).
 *
 * Memakai CSV, bukan penulis XLS: Excel membuka CSV dengan benar tanpa
 * dependensi tambahan, sementara lembar "xls" legacy sebenarnya juga HTML
 * bertabel — formatnya kebetulan saja bisa dibuka Excel.
 */
export const exportLeaveRequestsCsv = async (filter: {
  dateFrom?: string;
  dateTo?: string;
  leaveType?: string;
  statuses?: string[];
  letterStatus?: 'with' | 'without';
  search?: string;
  userId?: number;
}): Promise<string> => {
  const rows = await findLeaveRequestsForExport(filter);
  const lines: string[] = [CSV_HEADERS.join(';')];

  rows.forEach((row, index) => {
    lines.push([
      index + 1,
      row.name,
      row.nip,
      row.grade,
      row.position,
      row.organization_name,
      row.leave_type,
      row.reason,
      row.duration,
      row.duration_unit,
      toDateOnly(row.start_date),
      toDateOnly(row.end_date),
      toDateOnly(row.created_at),
      statusLabel(row),
      decisionLabel(row.approver_1_status, 1),
      decisionLabel(row.approver_2_status, 2),
      skNote(row),
    ].map(csvCell).join(';'));
  });

  return `${lines.join('\r\n')}\r\n`;
};

export const getLeaveRequestDetail = async (id: number) => {
  const request = await findLeaveRequestById(id);
  if (!request) throw notFound('Permohonan cuti tidak ditemukan');

  // Surat keterangan dan lampiran ikut dikirim supaya halaman detail tidak
  // perlu memanggil tiga endpoint terpisah.
  const { listByEntity } = await import('../../documents/service');
  const { findLeaveLetterByRequest } = await import('../query');
  const [letters, attachments, instance] = await Promise.all([
    findLeaveLetterByRequest(id),
    listByEntity('leave_requests', id),
    findInstanceProfile(),
  ]);
  return { ...request, letters, attachments, instance, verify_code: makeVerifyCode('leave_requests', id) };
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

const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const formatDateId = (value: string | null | undefined): string => {
  if (!value) return '-';
  const parts = String(value).slice(0, 10).split('-');
  if (parts.length !== 3) return String(value);
  const [y, m, d] = parts;
  return `${Number(d)} ${MONTHS_ID[Number(m) - 1] ?? m} ${y}`;
};

/** Hasilkan PDF surat keterangan cuti (SK) + QR resmi Kemenag Sleman, simpan ke MinIO. */
export const generateLeaveLetterPdf = async (
  id: number,
  actor: { id: number | string; role?: string },
) => {
  const detail = await getLeaveRequestDetail(id);
  const letter = (detail.letters as Array<Record<string, unknown>>).find(
    (item) => item.letter_type === 'suket',
  );
  if (!letter) throw badRequest('Terbitkan surat keterangan (SK) sebelum mencetak PDF');

  const { buildLeaveLetterOfficialPdf } = await import('../../../shared/pdf');
  const { verifyUrl } = await import('../../../shared/verify');
  const link = verifyUrl('leave_requests', id);
  const instance = (detail.instance ?? {}) as Record<string, string | null>;

  const pdf = await buildLeaveLetterOfficialPdf({
    number: String(letter.number ?? '-'),
    issued_at: String(letter.issued_at ?? new Date().toISOString().slice(0, 10)),
    name: detail.name,
    nip: detail.nip,
    grade: detail.grade,
    position: detail.position,
    organization: detail.organization_name,
    leave_type: detail.leave_type,
    duration: detail.duration,
    duration_unit: detail.duration_unit,
    start_date: detail.start_date as string,
    end_date: detail.end_date as string,
    reason: detail.reason,
    address: detail.address,
    phone: detail.phone,
    official_position: String(letter.official_position ?? instance.head_name ?? 'Kepala'),
    official_name: String(letter.official_name ?? instance.head_name ?? 'Sidik Pramono, S.Ag, M.Si'),
    instance_name: instance.name,
    instance_address: instance.address,
    verify_url: link,
  });

  const { uploadDocument, getDownloadUrl } = await import('../../documents/service');
  const uploaded = await uploadDocument({
    buffer: Buffer.from(pdf),
    filename: `sk-cuti-${String(letter.number ?? id)}.pdf`,
    mimeType: 'application/pdf',
    entityTable: 'leave_requests',
    entityId: id,
    field: 'sk_pdf',
    label: 'PDF surat keterangan cuti',
    actorId: Number(actor.id),
  });
  const download = await getDownloadUrl(uploaded.id);
  await insertAuditLog({
    actor_id: Number(actor.id),
    action: 'leave_letter_pdf_generate',
    entity_table: 'leave_requests',
    entity_id: id,
    after_data: { document_id: uploaded.id },
  });
  return { document_id: uploaded.id, url: download.url, verify_url: link };
};

/**
 * Saldo yang dicetak pada formulir.
 *
 * Angka manual yang dicatat admin saat memutuskan (legacy `tahunan_n*`)
 * diutamakan — itulah yang dilihat pegawai di berkas resmi. Kalau admin tidak
 * mengisinya, dipakai hasil hitung engine supaya formulir tetap terisi.
 */
const printQuotaBuckets = async (
  detail: Record<string, unknown>,
  year: number,
): Promise<{ n: number; n1: number; n2: number }> => {
  const n = detail.legacy_quota_n as number | null;
  const n1 = detail.legacy_quota_n1 as number | null;
  const n2 = detail.legacy_quota_n2 as number | null;
  if (n !== null && n !== undefined) {
    return { n: Number(n), n1: Number(n1 ?? 0), n2: Number(n2 ?? 0) };
  }
  try {
    const quota = await getQuota(Number(detail.user_id), year);
    return { n: quota.available.n, n1: quota.available.n1, n2: quota.available.n2 };
  } catch {
    return { n: 12, n1: 0, n2: 0 };
  }
};

/** Hasilkan PDF Formulir Permintaan dan Pemberian Cuti BKN (8 Bagian), simpan ke MinIO. */
export const generateLeaveFormPdf = async (
  id: number,
  actor: { id: number | string; role?: string },
) => {
  const detail = await getLeaveRequestDetail(id);
  if (actor.role && !canViewRequest(actor as { id: number | string; role: string }, detail)) {
    throw badRequest('Tidak berhak mencetak formulir cuti pegawai lain');
  }

  const { buildBknLeaveFormPdf } = await import('../../../shared/pdf');
  const instance = (detail.instance ?? {}) as Record<string, string | null>;
  const year = yearOf(detail.start_date as string);

  const buckets = await printQuotaBuckets(detail as Record<string, unknown>, year);

  const pdf = await buildBknLeaveFormPdf({
    name: detail.name,
    nip: detail.nip,
    grade: detail.grade,
    position: detail.position,
    organization: detail.organization_name,
    address: detail.address,
    phone: detail.phone,
    leave_type: detail.leave_type,
    duration: detail.duration,
    duration_unit: detail.duration_unit,
    start_date: detail.start_date as string,
    end_date: detail.end_date as string,
    reason: detail.reason,
    quota_n: buckets.n,
    quota_n1: buckets.n1,
    quota_n2: buckets.n2,
    approver_1_name: detail.approver_1_name,
    approver_1_nip: detail.approver_1_nip,
    approver_1_position: detail.approver_1_position,
    approver_2_name: detail.approver_2_name,
    approver_2_nip: detail.approver_2_nip,
    approver_2_position: detail.approver_2_position,
    instance_name: instance.name,
    instance_address: instance.address,
  });

  const { uploadDocument, getDownloadUrl } = await import('../../documents/service');
  const uploaded = await uploadDocument({
    buffer: Buffer.from(pdf),
    filename: `formulir-cuti-bkn-${id}.pdf`,
    mimeType: 'application/pdf',
    entityTable: 'leave_requests',
    entityId: id,
    field: 'bkn_form_pdf',
    label: 'PDF Formulir Cuti BKN',
    actorId: Number(actor.id),
  });
  const download = await getDownloadUrl(uploaded.id);
  await insertAuditLog({
    actor_id: Number(actor.id),
    action: 'leave_form_pdf_generate',
    entity_table: 'leave_requests',
    entity_id: id,
    after_data: { document_id: uploaded.id },
  });
  return { document_id: uploaded.id, url: download.url };
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
    return insertLeaveRequest(
      {
        user_id: input.user_id,
        name: profile?.name ?? '',
        nip,
        grade: profile?.grade ?? null,
        position: profile?.position_name ?? null,
        organization_name: profile?.organization_name ?? profile?.unit_name ?? null,
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
    const { uploadDocument } = await import('../../documents/service');
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

type DecisionInput = {
  actorId: number;
  note?: string;
  /** Sisa cuti manual yang dicatat admin (legacy `tahunan_n*`). */
  quota_n?: number;
  quota_n1?: number;
  quota_n2?: number;
  note_n?: string;
  note_n1?: string;
  note_n2?: string;
};

/** Kolom sisa-cuti manual; hanya ditulis kalau admin benar-benar mengisinya. */
const manualQuotaColumns = (input: DecisionInput) => ({
  ...(input.quota_n !== undefined ? { legacy_quota_n: input.quota_n } : {}),
  ...(input.quota_n1 !== undefined ? { legacy_quota_n1: input.quota_n1 } : {}),
  ...(input.quota_n2 !== undefined ? { legacy_quota_n2: input.quota_n2 } : {}),
  ...(input.note_n !== undefined ? { legacy_note_n: input.note_n } : {}),
  ...(input.note_n1 !== undefined ? { legacy_note_n1: input.note_n1 } : {}),
  ...(input.note_n2 !== undefined ? { legacy_note_n2: input.note_n2 } : {}),
});

/**
 * Apakah aktor berhak memutuskan di level ini?
 *
 * Legacy mengunci ini per NIP: `acc_atasan1.php` memfilter
 * `tsm.nip_atasan = $_SESSION['nip']` dan `acc_atasan2.php` memakai
 * `tsm.nip_atasan2`. Tanpa pemeriksaan itu, penunjukan atasan pada formulir
 * hanya jadi hiasan — siapa pun ber-role atasan bisa memutuskan permohonan
 * siapa pun. Admin tetap boleh memutuskan semuanya (legacy: `id_user = 1`).
 */
export const assertApproverAssignment = (
  request: LeaveRequestRow,
  level: 1 | 2,
  actor: { actorId: number; role?: string; nip?: string | null },
): void => {
  if (actor.role === 'admin') return;

  const assignedNip = level === 1 ? request.approver_1_nip : request.approver_2_nip;
  const assignedName = level === 1 ? request.approver_1_name : request.approver_2_name;

  // Permohonan lama (hasil migrasi) bisa belum punya NIP atasan; yang tersisa
  // hanya nama. Dalam hal itu pembatasan tidak bisa ditegakkan dan keputusan
  // diserahkan ke pemeriksaan peran, bukan ditolak tanpa jalan keluar.
  if (!assignedNip) return;

  if (!actor.nip || actor.nip !== assignedNip) {
    throw forbidden(
      `Permohonan ini ditugaskan kepada atasan ${level} dengan NIP ${assignedNip}${
        assignedName ? ` (${assignedName})` : ''
      }; Anda tidak berhak memutuskan.`,
    );
  }
};

/** Status akhir diturunkan dari kombinasi keputusan; bukan mutasi kuota manual. */
const deriveStatus = (
  adminDecision: string,
  approver1: string,
  approver2: string,
): LeaveRequestRow['status'] => {
  if (adminDecision === 'cancelled' || approver1 === 'cancelled' || approver2 === 'cancelled') {
    return 'cancelled';
  }
  if (
    adminDecision === 'rejected' ||
    approver1 === 'rejected' ||
    approver2 === 'rejected'
  ) {
    return 'rejected';
  }
  if (adminDecision === 'accepted' && approver1 === 'accepted' && approver2 === 'accepted') {
    return 'approved';
  }
  return 'in_review';
};

const nowStamp = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

/** Approval admin (level 1 pada legacy) dengan rebuild projection setelahnya. */
export const decideAdmin = async (
  id: number,
  input: DecisionInput & { decision: 'accepted' | 'rejected' | 'cancelled' },
) => {
  const request = await findLeaveRequestById(id);
  if (!request) throw notFound('Permohonan cuti tidak ditemukan');

  const before = {
    status: request.status,
    admin_decision: request.admin_decision,
    approver_1_status: request.approver_1_status,
    approver_2_status: request.approver_2_status,
  };
  const status = deriveStatus(input.decision, request.approver_1_status, request.approver_2_status);

  await updateLeaveDecision(id, {
    admin_decision: input.decision,
    admin_decided_by: input.actorId > 0 ? input.actorId : null,
    admin_decided_at: nowStamp(),
    status,
    rejection_reason: input.decision === 'rejected' ? (input.note ?? null) : request.rejection_reason,
    ...manualQuotaColumns(input),
  });

  await insertAuditLog({
    actor_id: input.actorId > 0 ? input.actorId : null,
    action: `leave_admin_${input.decision}`,
    entity_table: 'leave_requests',
    entity_id: id,
    before_data: before,
    after_data: {
      status,
      admin_decision: input.decision,
      note: input.note ?? null,
      quota_n: input.quota_n ?? null,
      quota_n1: input.quota_n1 ?? null,
      quota_n2: input.quota_n2 ?? null,
    },
  });

  await rebuildQuota(request.user_id, yearOf(request.start_date), input.actorId);
  return { id, status };
};

export const decideApprover = async (
  id: number,
  level: 1 | 2,
  input: DecisionInput & {
    decision: 'accepted' | 'rejected';
    /** Identitas pemutus; dipakai untuk mencocokkan NIP atasan yang ditunjuk. */
    actor: { actorId: number; role?: string; nip?: string | null };
  },
) => {
  const request = await findLeaveRequestById(id);
  if (!request) throw notFound('Permohonan cuti tidak ditemukan');

  await assertApproverAssignment(request, level, input.actor);

  if (level === 2 && request.approver_1_status !== 'accepted') {
    throw badRequest('Approval atasan 1 harus selesai lebih dulu');
  }

  // Legacy mengunci level 1 begitu atasan 2 sudah mengisi (`edit_acc_atasan1.php`
  // menolak kalau `acc_atasan2` tidak kosong) supaya urutannya tidak dibalik.
  if (level === 1 && request.approver_2_status !== 'pending') {
    throw badRequest('Keputusan atasan 1 terkunci karena atasan 2 sudah memutuskan');
  }

  const existingDecision = level === 1 ? request.approver_1_status : request.approver_2_status;
  if (existingDecision === input.decision) {
    // Idempotent: keputusan yang sama tidak diulang, perubahan lain dibatalkan.
    return { id, status: request.status, repeated: true };
  }

  const before = {
    status: request.status,
    approver_1_status: request.approver_1_status,
    approver_2_status: request.approver_2_status,
  };
  const nextApprover1: string = level === 1 ? input.decision : request.approver_1_status;
  const nextApprover2: string = level === 2 ? input.decision : request.approver_2_status;
  const status = deriveStatus(request.admin_decision, nextApprover1, nextApprover2);

  await updateLeaveDecision(id, {
    ...(level === 1
      ? {
          approver_1_status: input.decision,
          approver_1_id: input.actorId > 0 ? input.actorId : null,
          approver_1_decided_at: nowStamp(),
        }
      : {
          approver_2_status: input.decision,
          approver_2_id: input.actorId > 0 ? input.actorId : null,
          approver_2_decided_at: nowStamp(),
        }),
    status,
    ...(input.decision === 'rejected' && input.note ? { rejection_reason: input.note } : {}),
  });

  await insertAuditLog({
    actor_id: input.actorId > 0 ? input.actorId : null,
    action: `leave_approver_${level}_${input.decision}`,
    entity_table: 'leave_requests',
    entity_id: id,
    before_data: before,
    after_data: { status, level, decision: input.decision, note: input.note ?? null },
  });

  await rebuildQuota(request.user_id, yearOf(request.start_date), input.actorId);
  return { id, status };
};

export const cancelLeaveRequest = async (id: number, actorId: number, note?: string) => {
  const request = await findLeaveRequestById(id);
  if (!request) throw notFound('Permohonan cuti tidak ditemukan');

  if (request.status === 'cancelled') {
    return { id, status: 'cancelled' as const, repeated: true };
  }

  await updateLeaveDecision(id, {
    admin_decision: 'cancelled',
    status: 'cancelled',
    rejection_reason: note ?? 'Dibatalkan',
  });

  await insertAuditLog({
    actor_id: actorId > 0 ? actorId : null,
    action: 'leave_cancel',
    entity_table: 'leave_requests',
    entity_id: id,
    before_data: { status: request.status },
    after_data: { status: 'cancelled', note: note ?? null },
  });

  await rebuildQuota(request.user_id, yearOf(request.start_date), actorId);
  return { id, status: 'cancelled' as const };
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
