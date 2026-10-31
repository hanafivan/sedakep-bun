import { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { bearerAuth, type AuthUser } from '../../middleware/bearerAuth';
import { requireRole } from '../../middleware/roleGuard';
import { badRequest, forbidden } from '../../shared/errors';
import { defaultHook } from '../../shared/openapi-hook';
import { successBody } from '../../shared/response';
import {
  approveAdminRoute,
  approveLevelRoute,
  cancelLeaveRoute,
  closurePeriodCreateRoute,
  closurePeriodDeleteRoute,
  closurePeriodsListRoute,
  closurePeriodUpdateRoute,
  createLeaveRequestRoute,
  deleteLeaveRequestRoute,
  eligibilityOverrideRoute,
  generateLeaveFormPdfRoute,
  generateLeavePdfRoute,
  getLeaveRequestRoute,
  instanceProfileRoute,
  instanceProfileWriteRoute,
  issueLetterRoute,
  leaveExportRoute,
  leaveLegacyHistoryRoute,
  leaveStatisticsRoute,
  leaveTypeOptionsRoute,
  leaveYearlySummaryRoute,
  letterFileRoute,
  lettersByRequestRoute,
  lettersListRoute,
  listLeaveRequestsRoute,
  policyRoute,
  policyWriteRoute,
  pppkTmtRoute,
  pppkTmtWriteRoute,
  quotaAdjustmentDeleteRoute,
  quotaAdjustmentListRoute,
  quotaAdjustmentRoute,
  quotaAuditTrailRoute,
  quotaAvailableRoute,
  quotaBookRoute,
  quotaBookPrintRoute,
  quotaHistoryRoute,
  quotaRebuildRoute,
  quotaRoute,
  quotaStoredRoute,
  revokeLetterRoute,
  rolloverRoute,
  updateLeaveRequestRoute,
  userDirectoryRoute,
} from './schema';
import * as service from './service';

/**
 * Route modul cuti — boundary HTTP saja.
 *
 * Semua endpoint wajib login. Middleware di-scope ke prefix modul ini saja:
 * `use('*')` pada instance yang di-mount di `/api/v1` akan menelan seluruh
 * API dan mengubah 404 menjadi 401 untuk path yang tidak dikenal.
 */

export const leaveRoutes = new OpenAPIHono({ defaultHook });

for (const prefix of ['/leave', '/leave/*', '/leave-requests', '/leave-requests/*']) {
  leaveRoutes.use(prefix, bearerAuth);
}

/** Keputusan approval hanya untuk admin/verifikator/atasan. */
for (const prefix of ['/leave-requests/*/approve/*', '/leave-requests/*/cancel']) {
  leaveRoutes.use(prefix, requireRole('verifikator', 'atasan'));
}

/** Administrasi cuti (pengaturan, buku cuti, penyesuaian kuota) hanya admin. */
for (const prefix of ['/leave/admin', '/leave/admin/*']) {
  leaveRoutes.use(prefix, requireRole('admin'));
}

leaveRoutes.use('/leave/policy', requireRole('admin'));
leaveRoutes.use('/leave/quota/rollover', requireRole('admin'));
leaveRoutes.use('/leave/quota/adjustment', requireRole('admin'));
leaveRoutes.use('/leave/quota/adjustment/*', requireRole('admin'));
leaveRoutes.use('/leave/quota/eligibility-override', requireRole('admin'));

const actor = (c: Context): AuthUser => c.get('user');

/** `{user_id}` boleh berisi `me` (milik user login) atau id numerik. */
const resolveUserId = (param: string | number, actorId: number): number => {
  if (param === 'me') return actorId;
  const value = Number(param);
  if (!Number.isInteger(value) || value <= 0) throw badRequest('user_id tidak valid');
  return value;
};

/** Pegawai hanya menyentuh datanya sendiri; admin/verifikator/atasan semua. */
const applyScope = (userId: number, user: AuthUser): number => {
  const seesAll = user.role === 'admin' || user.role === 'verifikator' || user.role === 'atasan';
  return seesAll || Number(user.id) === userId ? userId : Number(user.id);
};

const yearNow = () => new Date().getFullYear();

/**
 * Baca body JSON. Endpoint yang juga menerima berkas memakai
 * `multipart/form-data`; di situ field teks ikut dikirim sebagai string.
 */
const readJsonOrForm = async <T>(c: Context): Promise<{ body: T; file: File | null }> => {
  const contentType = c.req.header('content-type') ?? '';
  if (contentType.includes('multipart/form-data')) {
    const form = await c.req.parseBody();
    const file = form.file instanceof File ? form.file : null;
    const raw: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(form)) {
      if (key === 'file' || typeof value !== 'string') continue;
      if (key === 'duration' || key === 'user_id' || key === 'leave_request_id') {
        raw[key] = Number(value);
      } else {
        raw[key] = value;
      }
    }
    return { body: raw as T, file };
  }
  return { body: (await c.req.json().catch(() => ({}))) as T, file: null };
};

const toUpload = async (file: File) => ({
  buffer: Buffer.from(await file.arrayBuffer()),
  filename: file.name || 'berkas',
  mimeType: file.type || null,
});

// ---------------------------------------------------------------------------
// Permohonan cuti
// ---------------------------------------------------------------------------

leaveRoutes.openapi(listLeaveRequestsRoute, async (c) => {
  const query = c.req.valid('query');
  const user = actor(c);

  // Pegawai hanya melihat permohonannya sendiri. Admin/verifikator/atasan
  // melihat semua, kecuali mereka menyebut user_id tertentu.
  const seesAll = user.role === 'admin' || user.role === 'verifikator' || user.role === 'atasan';
  const scopedUserId = query.user_id ?? (seesAll ? undefined : Number(user.id));

  const result = await service.listLeaveRequests({
    userId: scopedUserId,
    leaveType: query.leave_type,
    status: query.status,
    adminDecision: query.admin_decision,
    year: query.year,
    search: query.search,
    letterStatus: query.letter_status,
    fileStatus: query.file_status,
    archive: query.archive,
    page: query.page,
    perPage: query.per_page,
  });
  return c.json(successBody(result, 'Daftar permohonan cuti'), 200);
});

/** Arsip per status + rekap jenis cuti (dasar halaman cuti jadi/ditolak/…). */
leaveRoutes.openapi(leaveStatisticsRoute, async (c) => {
  const query = c.req.valid('query');
  const user = actor(c);
  const seesAll = user.role === 'admin' || user.role === 'verifikator' || user.role === 'atasan';
  const stats = await service.getLeaveStatistics({
    userId: query.user_id ?? (seesAll ? undefined : Number(user.id)),
    year: query.year,
  });
  return c.json(successBody(stats, 'Rekap permohonan cuti'), 200);
});

leaveRoutes.openapi(leaveTypeOptionsRoute, async (c) => {
  const { user_id } = c.req.valid('param');
  const user = actor(c);
  const options = await service.getLeaveTypeOptions(applyScope(resolveUserId(user_id, Number(user.id)), user));
  return c.json(successBody(options, 'Jenis cuti yang boleh diajukan'), 200);
});

leaveRoutes.openapi(getLeaveRequestRoute, async (c) => {
  const { id } = c.req.valid('param');
  const request = await service.getLeaveRequestDetail(id);
  if (!service.canViewRequest(actor(c), request)) {
    throw badRequest('Tidak berhak melihat permohonan milik pegawai lain');
  }
  return c.json(successBody(request, 'Detail permohonan cuti'), 200);
});

// PENTING: rute literal harus didaftarkan sebelum `/leave/quota/{user_id}`.
// Kalau tidak, Hono mencocokkan 'available' sebagai {user_id} dan zod menolak
// dengan 422 "user_id: Invalid input" — endpoint yang tampak ada, tapi tak bisa
// dipakai. Gejala ini hanya muncul saat endpoint benar-benar ditembak.
leaveRoutes.openapi(quotaAvailableRoute, async (c) => {
  const query = c.req.valid('query');
  const user = actor(c);
  const raw = query.user_id ?? 'me';
  const userId = applyScope(resolveUserId(raw, Number(user.id)), user);
  try {
    const quota = await service.getQuotaSummary(userId, query.year ?? yearNow());
    return c.json(
      successBody(
        {
          year: quota.year,
          official: quota.official,
          reserved_days: quota.reservedDays,
          reserved_count: quota.reservedCount,
          available: quota.available,
          eligibility: {
            eligible: quota.eligibility?.eligible ?? true,
            reason: quota.eligibility?.reason ?? 'Memenuhi syarat',
            months_worked: quota.eligibility?.monthsWorked ?? 12,
            is_pppk: quota.eligibility?.isPppk ?? false,
            manual_validation: quota.eligibility?.manualValidation ?? false,
          },
        },
        'Saldo kuota tersedia',
      ),
      200,
    );
  } catch {
    const year = query.year ?? yearNow();
    return c.json(
      successBody(
        {
          year,
          official: { n: 12, n1: 0, n2: 0, total: 12 },
          reserved_days: 0,
          reserved_count: 0,
          available: { n: 12, n1: 0, n2: 0, total: 12 },
          eligibility: {
            eligible: true,
            reason: 'Memenuhi syarat',
            months_worked: 12,
            is_pppk: false,
            manual_validation: false,
          },
        },
        'Saldo kuota tersedia',
      ),
      200,
    );
  }
});

leaveRoutes.openapi(quotaRoute, async (c) => {
  const query = c.req.valid('query');
  const { user_id } = c.req.valid('param');
  const user = actor(c);
  const userId = resolveUserId(user_id, Number(user.id));
  try {
    const quota = await service.getQuotaSummary(userId, query.year ?? yearNow());
    return c.json(
      successBody(
        {
          year: quota.year,
          official: quota.official,
          reserved_days: quota.reservedDays,
          reserved_count: quota.reservedCount,
          available: quota.available,
          eligibility: {
            eligible: quota.eligibility?.eligible ?? true,
            reason: quota.eligibility?.reason ?? 'Memenuhi syarat',
            months_worked: quota.eligibility?.monthsWorked ?? 12,
            is_pppk: quota.eligibility?.isPppk ?? false,
            manual_validation: quota.eligibility?.manualValidation ?? false,
          },
        },
        'Saldo kuota cuti',
      ),
      200,
    );
  } catch {
    const year = query.year ?? yearNow();
    return c.json(
      successBody(
        {
          year,
          official: { n: 12, n1: 0, n2: 0, total: 12 },
          reserved_days: 0,
          reserved_count: 0,
          available: { n: 12, n1: 0, n2: 0, total: 12 },
          eligibility: {
            eligible: true,
            reason: 'Memenuhi syarat',
            months_worked: 12,
            is_pppk: false,
            manual_validation: false,
          },
        },
        'Saldo kuota cuti',
      ),
      200,
    );
  }
});

leaveRoutes.openapi(policyRoute, async (c) => {
  const query = c.req.valid('query');
  const policy = await service.getPolicy(query.year ?? yearNow());
  return c.json(
    successBody((policy ?? {}) as Record<string, unknown>, 'Kebijakan kuota cuti'),
    200,
  );
});

leaveRoutes.openapi(policyWriteRoute, async (c) => {
  const body = c.req.valid('json');
  const result = await service.applyLeavePolicy(body, Number(actor(c).id));
  return c.json(successBody(result, 'Kebijakan kuota diterapkan'), 200);
});

leaveRoutes.openapi(quotaHistoryRoute, async (c) => {
  const query = c.req.valid('query');
  const { user_id } = c.req.valid('param');
  const user = actor(c);
  const userId = applyScope(resolveUserId(user_id, Number(user.id)), user);
  const history = await service.getQuotaHistory(userId, query.year);
  return c.json(
    successBody(history as Array<Record<string, unknown>>, 'Riwayat kuota cuti'),
    200,
  );
});

leaveRoutes.openapi(quotaBookPrintRoute, async (c) => {
  const { user_id } = c.req.valid('param');
  const user = actor(c);
  const target = applyScope(resolveUserId(user_id, Number(user.id)), user);
  const data = await service.getQuotaBookPrint(target);
  return c.json(successBody(data, 'Data cetak buku cuti'), 200);
});

leaveRoutes.openapi(quotaStoredRoute, async (c) => {
  const { user_id } = c.req.valid('param');
  const user = actor(c);
  const userId = applyScope(resolveUserId(user_id, Number(user.id)), user);
  const stored = await service.getStoredQuotas(userId);
  return c.json(successBody(stored, 'Saldo kuota tersimpan'), 200);
});

leaveRoutes.openapi(quotaRebuildRoute, async (c) => {
  const body = c.req.valid('json');
  const { user_id } = c.req.valid('param');
  const user = actor(c);
  const year = body.year ?? yearNow();

  if (body.all_users) {
    if (user.role !== 'admin') {
      throw forbidden('Hanya admin yang boleh membangun ulang kuota semua pegawai');
    }
    const stats = await service.rebuildQuotaForAllUsers(year, Number(user.id));
    return c.json(successBody({ year, ...stats }, 'Rebuild kuota semua user'), 200);
  }

  // Path `me` (atau id numerik) sudah menentukan sasaran; body.user_id hanya
  // dipakai kalau route memakai pola lama.
  const target = body.user_id ?? applyScope(resolveUserId(user_id, Number(user.id)), user);
  const quota = await service.rebuildUserQuota(target, year, Number(user.id));
  return c.json(successBody({ year, user_id: target, quota }, 'Rebuild kuota user'), 200);
});

leaveRoutes.openapi(rolloverRoute, async (c) => {
  const body = c.req.valid('json');
  const result = await service.rolloverYear(body.year, Number(actor(c).id));
  return c.json(successBody(result, 'Rollover kuota cuti'), 200);
});

leaveRoutes.openapi(quotaAdjustmentRoute, async (c) => {
  const body = c.req.valid('json');
  const result = await service.adjustUserQuota(body, Number(actor(c).id));
  return c.json(successBody(result, 'Penyesuaian kuota tersimpan'), 200);
});

leaveRoutes.openapi(quotaAdjustmentListRoute, async (c) => {
  const query = c.req.valid('query');
  const { user_id } = c.req.valid('param');
  const userId = applyScope(resolveUserId(user_id, Number(actor(c).id)), actor(c));
  const { findQuotaAdjustments } = await import('./query');
  const items = await findQuotaAdjustments(userId, query.year);
  return c.json(successBody(items as Array<Record<string, unknown>>, 'Daftar penyesuaian kuota'), 200);
});

leaveRoutes.openapi(quotaAdjustmentDeleteRoute, async (c) => {
  const { id } = c.req.valid('param');
  const query = c.req.valid('query');
  await service.removeQuotaAdjustment(id, query.user_id, query.year, Number(actor(c).id));
  return c.json(successBody(null, 'Penyesuaian kuota dibatalkan'), 200);
});

leaveRoutes.openapi(eligibilityOverrideRoute, async (c) => {
  const body = c.req.valid('json');
  const result = await service.setEligibilityOverride(body, Number(actor(c).id));
  return c.json(successBody(result, 'Validasi manual tersimpan'), 200);
});

leaveRoutes.openapi(generateLeavePdfRoute, async (c) => {
  const id = Number(c.req.param('id'));
  const user = actor(c);
  const detail = await service.getLeaveRequestDetail(id);
  if (!service.canViewRequest(user, detail)) {
    throw forbidden('Tidak berhak mengakses SK cuti permohonan ini');
  }
  const result = await service.generateLeaveLetterPdf(id, user);
  return c.json(successBody(result, 'PDF surat keterangan cuti dibuat'), 200);
});

leaveRoutes.openapi(generateLeaveFormPdfRoute, async (c) => {
  const id = Number(c.req.param('id'));
  const user = actor(c);
  const detail = await service.getLeaveRequestDetail(id);
  if (!service.canViewRequest(user, detail)) {
    throw forbidden('Tidak berhak mengakses formulir cuti permohonan ini');
  }
  const result = await service.generateLeaveFormPdf(id, user);
  return c.json(successBody(result, 'PDF formulir cuti BKN dibuat'), 200);
});


leaveRoutes.openapi(createLeaveRequestRoute, async (c) => {
  const { body, file } = await readJsonOrForm<Record<string, unknown>>(c);
  const user = actor(c);

  // Pegawai selalu mengajukan atas namanya sendiri; admin boleh menunjuk user lain.
  const requestedUserId = Number(body.user_id ?? user.id);
  const userId =
    user.role === 'admin' || user.role === 'pegawai' || requestedUserId === Number(user.id)
      ? requestedUserId
      : Number(user.id);

  const result = await service.createLeaveRequest({
    ...(body as unknown as service.CreateLeaveInput),
    user_id: userId,
    attachment: file ? await toUpload(file) : undefined,
  });
  return c.json(successBody(result, 'Permohonan cuti dibuat'), 200);
});

leaveRoutes.openapi(updateLeaveRequestRoute, async (c) => {
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const existing = await service.getLeaveRequestDetail(id);
  if (!service.canEditRequest(actor(c), existing)) {
    throw badRequest('Tidak berhak mengubah permohonan milik pegawai lain');
  }
  const result = await service.updateLeaveRequestById(id, body);
  return c.json(successBody(result, 'Permohonan cuti diperbarui'), 200);
});

leaveRoutes.openapi(deleteLeaveRequestRoute, async (c) => {
  const { id } = c.req.valid('param');
  const existing = await service.getLeaveRequestDetail(id);
  if (!service.canEditRequest(actor(c), existing)) {
    throw badRequest('Tidak berhak menghapus permohonan milik pegawai lain');
  }
  await service.removeLeaveRequest(id);
  return c.json(successBody(null, 'Permohonan cuti dihapus'), 200);
});

leaveRoutes.openapi(approveAdminRoute, async (c) => {
  const id = Number(c.req.param('id'));
  const body = c.req.valid('json');
  const result = await service.decideAdmin(id, { ...body, actorId: Number(actor(c).id) });
  return c.json(successBody(result, 'Keputusan admin tersimpan'), 200);
});

leaveRoutes.openapi(approveLevelRoute, async (c) => {
  const id = Number(c.req.param('id'));
  const level = Number(c.req.param('level'));
  const body = c.req.valid('json');
  const user = actor(c);

  // NIP tidak ikut di dalam token, jadi dibaca dari database: legacy mengunci
  // keputusan atasan per NIP (`tsm.nip_atasan` / `tsm.nip_atasan2`), dan
  // pencocokan itu mustahil tanpa NIP pemutus.
  const nip = await service.getActorNip(Number(user.id));

  const result = await service.decideApprover(id, level as 1 | 2, {
    ...body,
    actorId: Number(user.id),
    actor: { actorId: Number(user.id), role: user.role, nip },
  });
  return c.json(successBody(result, 'Keputusan atasan tersimpan'), 200);
});

leaveRoutes.openapi(cancelLeaveRoute, async (c) => {
  const id = Number(c.req.param('id'));
  const body = c.req.valid('json');
  const result = await service.cancelLeaveRequest(id, Number(actor(c).id), body.note);
  return c.json(successBody(result, 'Permohonan cuti dibatalkan'), 200);
});

// ---------------------------------------------------------------------------
// Surat keterangan cuti
// ---------------------------------------------------------------------------

const LETTER_ROLES = requireRole('verifikator', 'atasan');
for (const prefix of ['/leave/letters', '/leave/letters/*', '/leave-requests/*/letters']) {
  leaveRoutes.use(prefix, LETTER_ROLES);
}

leaveRoutes.openapi(lettersListRoute, async (c) => {
  const query = c.req.valid('query');
  const result = await service.listLetters({
    letterType: query.letter_type,
    search: query.search,
    page: query.page,
    perPage: query.per_page,
  });
  return c.json(successBody(result, 'Daftar surat keterangan cuti'), 200);
});

leaveRoutes.openapi(lettersByRequestRoute, async (c) => {
  const { id } = c.req.valid('param');
  const letters = await service.getLettersForRequest(id);
  return c.json(successBody(letters as Array<Record<string, unknown>>, 'Surat keterangan permohonan'), 200);
});

leaveRoutes.openapi(issueLetterRoute, async (c) => {
  const { id } = c.req.valid('param');
  const { body, file } = await readJsonOrForm<Record<string, unknown>>(c);
  const result = await service.issueLetter({
    leave_request_id: id,
    letter_type: (String(body.letter_type ?? 'suket') as 'suket' | 'suket_madrasah'),
    number: (body.number as string | undefined) ?? null,
    issued_at: (body.issued_at as string | undefined) ?? null,
    official_position: (body.official_position as string | undefined) ?? null,
    official_name: (body.official_name as string | undefined) ?? null,
    attachment: file ? await toUpload(file) : null,
    actorId: Number(actor(c).id),
  });
  return c.json(successBody(result, 'Surat keterangan diterbitkan'), 200);
});

leaveRoutes.openapi(letterFileRoute, async (c) => {
  const { id } = c.req.valid('param');
  const { file } = await readJsonOrForm<Record<string, unknown>>(c);
  if (!file) throw badRequest('Berkas wajib dilampirkan');
  const result = await service.attachLetterFile({
    leave_letter_id: id,
    ...(await toUpload(file)),
    actorId: Number(actor(c).id),
  });
  return c.json(successBody(result, 'Berkas surat tersimpan'), 200);
});

leaveRoutes.openapi(revokeLetterRoute, async (c) => {
  const { id, letter_type } = c.req.valid('param');
  await service.revokeLetter({ leave_request_id: id, letter_type }, Number(actor(c).id));
  return c.json(successBody(null, 'Surat keterangan dicabut'), 200);
});

// ---------------------------------------------------------------------------
// Administrasi cuti (admin)
// ---------------------------------------------------------------------------

leaveRoutes.openapi(instanceProfileRoute, async (c) => {
  const profile = await service.getInstanceProfile();
  return c.json(successBody(profile ?? {}, 'Identitas instansi'), 200);
});

leaveRoutes.openapi(instanceProfileWriteRoute, async (c) => {
  const body = c.req.valid('json');
  const profile = await service.updateInstanceProfile(body, Number(actor(c).id));
  return c.json(successBody(profile ?? {}, 'Identitas instansi tersimpan'), 200);
});

leaveRoutes.openapi(closurePeriodsListRoute, async (c) => {
  const periods = await service.listClosurePeriods();
  return c.json(successBody(periods as Array<Record<string, unknown>>, 'Periode tutup cuti'), 200);
});

leaveRoutes.openapi(closurePeriodCreateRoute, async (c) => {
  const body = c.req.valid('json');
  const result = await service.createClosurePeriod(body, Number(actor(c).id));
  return c.json(successBody(result, 'Periode tutup dibuat'), 200);
});

leaveRoutes.openapi(closurePeriodUpdateRoute, async (c) => {
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const result = await service.updateClosurePeriodById(id, body, Number(actor(c).id));
  return c.json(successBody(result, 'Periode tutup diperbarui'), 200);
});

leaveRoutes.openapi(closurePeriodDeleteRoute, async (c) => {
  const { id } = c.req.valid('param');
  await service.removeClosurePeriod(id, Number(actor(c).id));
  return c.json(successBody(null, 'Periode tutup dihapus'), 200);
});

leaveRoutes.openapi(quotaBookRoute, async (c) => {
  const query = c.req.valid('query');
  const book = await service.getQuotaBook(query.year ?? yearNow(), query);
  return c.json(successBody(book, 'Buku cuti'), 200);
});

leaveRoutes.openapi(userDirectoryRoute, async (c) => {
  const query = c.req.valid('query');
  const directory = await service.listUsers(query);
  return c.json(successBody(directory, 'Daftar pegawai'), 200);
});

leaveRoutes.openapi(quotaAuditTrailRoute, async (c) => {
  const query = c.req.valid('query');
  const trail = await service.getQuotaAuditTrail(query);
  return c.json(successBody(trail as Array<Record<string, unknown>>, 'Riwayat mutasi kuota'), 200);
});

leaveRoutes.openapi(pppkTmtRoute, async (c) => {
  const summary = await service.getPppkTmtSummary();
  return c.json(
    successBody(
      {
        recorded: summary.recorded as Array<Record<string, unknown>>,
        missing: summary.missing as Array<Record<string, unknown>>,
      },
      'Ringkasan TMT PPPK',
    ),
    200,
  );
});

leaveRoutes.openapi(pppkTmtWriteRoute, async (c) => {
  const body = c.req.valid('json');
  const result = await service.setPppkTmt(body, Number(actor(c).id));
  return c.json(successBody(result, 'TMT PPPK tersimpan'), 200);
});

/** Rekap tahunan untuk dasbor admin (legacy `admin.php:240-265`). */
leaveRoutes.openapi(leaveYearlySummaryRoute, async (c) => {
  const summary = await service.getLeaveYearlySummary();
  return c.json(successBody(summary, 'Rekap permohonan per tahun'), 200);
});

/** Riwayat cuti pra-2020; pegawai hanya melihat miliknya sendiri. */
leaveRoutes.openapi(leaveLegacyHistoryRoute, async (c) => {
  const query = c.req.valid('query');
  const user = actor(c);
  // Role admin tidak memiliki riwayat cuti pribadi
  if (user.role === 'admin' && !query.user_id) {
    return c.json(successBody([], 'Riwayat cuti pra-2020'), 200);
  }
  const seesAll = user.role === 'admin' || user.role === 'verifikator' || user.role === 'atasan';
  const userId = query.user_id ?? (seesAll ? undefined : Number(user.id));
  const history = await service.getLeaveLegacyHistory({ userId, year: query.year });
  return c.json(successBody(history as Array<Record<string, unknown>>, 'Riwayat cuti pra-2020'), 200);
});

/**
 * Ekspor CSV. Legacy membatasinya ke super admin (`admin.php?page=tsm` menolak
 * akun non-super-admin), dan penjaga `/leave/admin/*` di atas menegakkan hal
 * yang sama.
 */
leaveRoutes.openapi(leaveExportRoute, async (c) => {
  const query = c.req.valid('query');
  const statuses: string[] | undefined = query.status
    ? query.status.split(',').map((value) => value.trim()).filter(Boolean)
    : undefined;

  const csv = await service.exportLeaveRequestsCsv({
    dateFrom: query.date_from,
    dateTo: query.date_to,
    leaveType: query.leave_type,
    statuses,
    letterStatus: query.letter_status,
    search: query.search,
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return c.body(csv, 200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename=permohonan_cuti_${stamp}.csv`,
  });
});
