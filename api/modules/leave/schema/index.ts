import { z } from 'zod';
import { createRoute } from '@hono/zod-openapi';
import {
  ApiErrorSchema,
  LeaveRequestSchema,
  QuotaBucketSchema,
  QuotaResponseSchema,
  StoredQuotaSchema,
  errorResponses,
  json,
  ok,
} from './shared';

/**
 * Schema request/response + definisi route modul cuti.
 * Zod double sebagai spesifikasi OpenAPI.
 */

export const LeaveTypeEnum = z.enum([
  'Cuti Tahunan',
  'Cuti Sakit',
  'Cuti Alasan Penting',
  'Cuti Besar',
  'Cuti Melahirkan',
  'Cuti Di Luar Tanggungan Negara',
]);

export const DurationUnitEnum = z.enum(['day', 'month', 'year']);

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD');

export const CreateLeaveRequestSchema = z.object({
  // `coerce` supaya pengajuan multipart (form field selalu string) lolos
  // validasi yang sama dengan pengajuan JSON. Tanpa ini, unggah lampiran
  // ditolak 422 "duration: Expected number, received string" sebelum handler
  // sempat berjalan.
  user_id: z.coerce.number().int().positive().optional(),
  leave_type: LeaveTypeEnum,
  duration: z.coerce.number().int().positive().max(1095),
  duration_unit: DurationUnitEnum.default('day'),
  start_date: DateSchema,
  end_date: DateSchema,
  reason: z.string().max(500).optional(),
  address: z.string().optional(),
  phone: z.string().max(30).optional(),
  approver_1_name: z.string().max(150).optional(),
  approver_1_nip: z.string().max(18).optional(),
  approver_1_position: z.string().max(150).optional(),
  approver_2_name: z.string().max(150).optional(),
  approver_2_nip: z.string().max(18).optional(),
  approver_2_position: z.string().max(150).optional(),
}).openapi('CreateLeaveRequest');

export const UpdateLeaveRequestSchema = CreateLeaveRequestSchema.partial()
  .omit({ user_id: true })
  .openapi('UpdateLeaveRequest');

export const DecisionSchema = z.object({
  decision: z.enum(['accepted', 'rejected']),
  note: z.string().max(500).optional(),
  /**
   * Sisa cuti yang dicatat admin saat memutuskan.
   *
   * Legacy meminta admin mengetik `tahunan_n`, `tahunan_n1`, `tahunan_n2`
   * beserta keterangannya di `tambah_acc.php`, lalu angka itu yang dicetak
   * pada formulir cuti. Di sini nilainya opsional: kalau diisi, angka manual
   * itulah yang dipakai saat mencetak; kalau kosong, dipakai hasil hitung
   * engine.
   */
  quota_n: z.coerce.number().int().min(0).max(365).optional(),
  quota_n1: z.coerce.number().int().min(0).max(365).optional(),
  quota_n2: z.coerce.number().int().min(0).max(365).optional(),
  note_n: z.string().max(50).optional(),
  note_n1: z.string().max(50).optional(),
  note_n2: z.string().max(50).optional(),
}).openapi('LeaveDecision');

export const CancelSchema = z.object({
  note: z.string().max(500).optional(),
}).openapi('LeaveCancel');

export type CreateLeaveInputSchema = z.infer<typeof CreateLeaveRequestSchema>;
export type UpdateLeaveInputSchema = z.infer<typeof UpdateLeaveRequestSchema>;

export const ListQuerySchema = z.object({
  user_id: z.coerce.number().int().positive().optional(),
  leave_type: z.string().optional(),
  status: z.string().optional(),
  admin_decision: z.enum(['pending', 'accepted', 'rejected', 'cancelled']).optional(),
  year: z.coerce.number().int().optional(),
  search: z.string().optional(),
  /** Arsip "Sudah/Belum ada SK" (legacy `sk_status`). */
  letter_status: z.enum(['with', 'without']).optional(),
  file_status: z.enum(['with', 'without']).optional(),
  archive: z.enum(['all', 'belum_diperiksa', 'belum_kirim', 'sk_belum_upload', 'cuti_jadi', 'ditolak', 'dibatalkan']).optional(),
  page: z.coerce.number().int().positive().optional(),
  per_page: z.coerce.number().int().positive().max(200).optional(),
});

export const QuotaQuerySchema = z.object({
  user_id: z.coerce.number().int().positive().optional(),
  year: z.coerce.number().int().optional(),
});

export const YearQuerySchema = z.object({
  year: z.coerce.number().int().optional(),
});

export const IdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

/**
 * Kuota boleh diakses lewat path sendiri ({user_id}) atau milik user yang
 * login ({user_id}="me"). Bentuk kedua dipakai frontend supaya identitas
 * tidak perlu ditebak di klien.
 */
export const MeOrIdParamSchema = z.object({
  user_id: z.union([z.literal('me'), z.coerce.number().int().positive()]),
});

export const RebuildSchema = z.object({
  user_id: z.number().int().positive().optional(),
  year: z.number().int().optional(),
  all_users: z.boolean().optional(),
}).openapi('QuotaRebuild');

export {
  ApiErrorSchema,
  LeaveRequestSchema,
  QuotaBucketSchema,
  QuotaResponseSchema,
  StoredQuotaSchema,
};

// ---------------------------------------------------------------------------
// Permohonan cuti
// ---------------------------------------------------------------------------

export const listLeaveRequestsRoute = createRoute({
  method: 'get',
  path: '/leave-requests',
  tags: ['Leave'],
  summary: 'Daftar permohonan cuti',
  request: { query: ListQuerySchema },
  responses: {
    200: {
      description: 'Daftar permohonan',
      ...json(ok(
        z.object({
          items: z.array(LeaveRequestSchema),
          total: z.number(),
          page: z.number(),
          per_page: z.number(),
          total_pages: z.number(),
        }),
        'LeaveRequestListResponse',
      )),
    },
    ...errorResponses({ 401: 'Tidak terautentikasi', 422: 'Validasi gagal' }),
  },
});

export const leaveStatisticsRoute = createRoute({
  method: 'get',
  path: '/leave-requests/statistics',
  tags: ['Leave'],
  summary: 'Rekap jumlah permohonan per status dan jenis cuti',
  request: { query: z.object({
    user_id: z.coerce.number().int().positive().optional(),
    year: z.coerce.number().int().optional(),
  }) },
  responses: {
    200: {
      description: 'Rekap permohonan',
      ...json(ok(z.record(z.any()), 'LeaveStatisticsResponse')),
    },
    ...errorResponses({ 401: 'Tidak terautentikasi' }),
  },
});

export const leaveTypeOptionsRoute = createRoute({
  method: 'get',
  path: '/leave/types/{user_id}',
  tags: ['Leave'],
  summary: 'Jenis cuti yang boleh diajukan pegawai beserta aturannya',
  request: { params: MeOrIdParamSchema },
  responses: {
    200: {
      description: 'Opsi jenis cuti',
      ...json(ok(z.record(z.any()), 'LeaveTypeOptionsResponse')),
    },
    ...errorResponses({ 401: 'Tidak terautentikasi' }),
  },
});

export const getLeaveRequestRoute = createRoute({
  method: 'get',
  path: '/leave-requests/{id}',
  tags: ['Leave'],
  summary: 'Detail permohonan cuti (termasuk surat dan lampiran)',
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: 'Detail permohonan',
      ...json(ok(z.record(z.any()), 'LeaveRequestDetailResponse')),
    },
    ...errorResponses({ 403: 'Bukan pemilik', 404: 'Tidak ditemukan' }),
  },
});

export const generateLeavePdfRoute = createRoute({
  method: 'post',
  path: '/leave-requests/{id}/pdf',
  tags: ['Leave Letters'],
  summary: 'Hasilkan PDF surat keterangan cuti (SK) + QR',
  security: [{ bearerAuth: [] }],
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: 'PDF dibuat',
      ...json(ok(z.record(z.any()), 'LeavePdfResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan staf', 404: 'Tidak ditemukan' }),
  },
});

export const generateLeaveFormPdfRoute = createRoute({
  method: 'post',
  path: '/leave-requests/{id}/form-pdf',
  tags: ['Leave Letters'],
  summary: 'Hasilkan PDF formulir permintaan dan pemberian cuti BKN (8 bagian)',
  security: [{ bearerAuth: [] }],
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: 'PDF formulir BKN dibuat',
      ...json(ok(z.record(z.any()), 'LeaveFormPdfResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan pemilik/staf', 404: 'Tidak ditemukan' }),
  },
});


export const createLeaveRequestRoute = createRoute({
  method: 'post',
  path: '/leave-requests',
  tags: ['Leave'],
  summary: 'Ajukan permohonan cuti (validasi kuota server-side + kunci user/tahun)',
  request: {
    body: {
      content: {
        'application/json': { schema: CreateLeaveRequestSchema },
        // Lampiran boleh disertakan langsung saat mengajukan.
        'multipart/form-data': {
          schema: CreateLeaveRequestSchema.extend({ file: z.any().optional() }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Permohonan dibuat',
      ...json(ok(
        z.object({ id: z.number(), attachment_id: z.number().nullable() }),
        'CreateLeaveResponse',
      )),
    },
    ...errorResponses({ 400: 'Kuota tidak cukup / tidak eligible', 409: 'Bentrok data', 422: 'Validasi gagal' }),
  },
});

export const updateLeaveRequestRoute = createRoute({
  method: 'patch',
  path: '/leave-requests/{id}',
  tags: ['Leave'],
  summary: 'Ubah permohonan cuti (mengecualikan dirinya dari perhitungan kuota)',
  request: { params: IdParamSchema, body: json(UpdateLeaveRequestSchema) },
  responses: {
    200: {
      description: 'Permohonan diperbarui',
      ...json(ok(z.object({ id: z.number() }), 'UpdateLeaveResponse')),
    },
    ...errorResponses({ 400: 'Sudah final', 404: 'Tidak ditemukan', 422: 'Validasi gagal' }),
  },
});

export const deleteLeaveRequestRoute = createRoute({
  method: 'delete',
  path: '/leave-requests/{id}',
  tags: ['Leave'],
  summary: 'Hapus permohonan cuti yang belum final',
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: 'Permohonan dihapus',
      ...json(ok(z.null(), 'DeleteLeaveResponse')),
    },
    ...errorResponses({ 400: 'Sudah final', 404: 'Tidak ditemukan' }),
  },
});

export const approveAdminRoute = createRoute({
  method: 'post',
  path: '/leave-requests/{id}/approve/admin',
  tags: ['Leave Approval'],
  summary: 'Keputusan admin (approval utama)',
  request: { params: IdParamSchema, body: json(DecisionSchema) },
  responses: {
    200: {
      description: 'Keputusan tersimpan',
      ...json(ok(z.object({ id: z.number(), status: z.string() }), 'AdminDecisionResponse')),
    },
    ...errorResponses({ 404: 'Tidak ditemukan', 422: 'Validasi gagal' }),
  },
});

export const approveLevelRoute = createRoute({
  method: 'post',
  // Segmen parsial seperti `level-{level}` terdaftar di OpenAPI tetapi tidak
  // dikompilasi router Hono (selalu 404). Pakai segmen path biasa.
  path: '/leave-requests/{id}/approve/level/{level}',
  tags: ['Leave Approval'],
  summary: 'Keputusan atasan level 1 atau 2',
  request: {
    params: IdParamSchema.extend({ level: z.coerce.number().int().min(1).max(2) }),
    body: json(DecisionSchema),
  },
  responses: {
    200: {
      description: 'Keputusan tersimpan',
      ...json(ok(
        z.object({ id: z.number(), status: z.string(), repeated: z.boolean().optional() }),
        'ApproverDecisionResponse',
      )),
    },
    ...errorResponses({ 400: 'Urutan approval salah', 404: 'Tidak ditemukan' }),
  },
});

/** Alias sesuai penamaan plan: /approve/level-1 dan /approve/level-2. */
export const approveLevelAliasRoute = createRoute({
  method: 'post',
  path: '/leave-requests/{id}/approve/level-{level}',
  tags: ['Leave Approval'],
  summary: 'Alias keputusan atasan (level-1 / level-2)',
  request: {
    params: IdParamSchema.extend({ level: z.coerce.number().int().min(1).max(2) }),
    body: json(DecisionSchema),
  },
  responses: {
    200: {
      description: 'Keputusan tersimpan',
      ...json(ok(z.record(z.any()), 'ApproverDecisionAliasResponse')),
    },
    ...errorResponses({ 404: 'Tidak ditemukan' }),
  },
});

export const cancelLeaveRoute = createRoute({
  method: 'post',
  path: '/leave-requests/{id}/cancel',
  tags: ['Leave Approval'],
  summary: 'Batalkan permohonan cuti',
  request: { params: IdParamSchema, body: json(CancelSchema) },
  responses: {
    200: {
      description: 'Permohonan dibatalkan',
      ...json(ok(z.object({ id: z.number() }), 'CancelLeaveResponse')),
    },
    ...errorResponses({ 404: 'Tidak ditemukan' }),
  },
});

// ---------------------------------------------------------------------------
// Kuota
// ---------------------------------------------------------------------------

export const quotaRoute = createRoute({
  method: 'get',
  path: '/leave/quota/{user_id}',
  tags: ['Leave Quota'],
  summary: 'Saldo kuota (official, reserved, available)',
  security: [{ bearerAuth: [] }],
  request: { query: QuotaQuerySchema, params: MeOrIdParamSchema },
  responses: {
    200: {
      description: 'Saldo kuota',
      ...json(ok(QuotaResponseSchema, 'QuotaSummaryResponse')),
    },
    ...errorResponses({ 422: 'Validasi gagal' }),
  },
});

/** Bentuk query yang diminta plan; angkanya sama dengan endpoint di atas. */
export const quotaAvailableRoute = createRoute({
  method: 'get',
  path: '/leave/quota/available',
  tags: ['Leave Quota'],
  summary: 'Saldo tersedia (available) untuk user dan tahun tertentu',
  security: [{ bearerAuth: [] }],
  request: { query: z.object({
    user_id: z.union([z.literal('me'), z.coerce.number().int().positive()]).optional(),
    year: z.coerce.number().int().optional(),
  }) },
  responses: {
    200: {
      description: 'Saldo tersedia',
      ...json(ok(QuotaResponseSchema, 'QuotaAvailableResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 422: 'Validasi gagal' }),
  },
});

export const quotaHistoryRoute = createRoute({
  method: 'get',
  path: '/leave/quota/history/{user_id}',
  tags: ['Leave Quota'],
  summary: 'Riwayat audit kuota',
  security: [{ bearerAuth: [] }],
  request: { query: QuotaQuerySchema, params: MeOrIdParamSchema },
  responses: {
    200: {
      description: 'Riwayat kuota',
      ...json(ok(z.array(z.record(z.any())), 'QuotaHistoryResponse')),
    },
    ...errorResponses({ 422: 'Validasi gagal' }),
  },
});

export const policyRoute = createRoute({
  method: 'get',
  path: '/leave/policy',
  tags: ['Leave Quota'],
  summary: 'Kebijakan kuota satu tahun',
  security: [{ bearerAuth: [] }],
  request: { query: YearQuerySchema },
  responses: {
    200: {
      description: 'Kebijakan kuota',
      ...json(ok(z.record(z.any()), 'LeavePolicyResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 404: 'Kebijakan tidak ada' }),
  },
});

export const PolicyWriteSchema = z.object({
  year: z.number().int(),
  default_days: z.number().int().min(0).max(60),
  days_after_sk: z.number().int().min(0).max(60).optional(),
  sk_applied: z.boolean().optional(),
  sk_issued_at: DateSchema.nullable().optional(),
  notes: z.string().max(1000).optional(),
  carry_over_max_n1: z.number().int().min(0).max(24).optional(),
  carry_over_max_n2: z.number().int().min(0).max(24).optional(),
  min_service_months: z.number().int().min(0).max(120).optional(),
  /** Wajib true kalau tahun itu sudah pernah diterapkan. */
  confirm: z.boolean().optional(),
}).openapi('LeavePolicyWrite');

export const policyWriteRoute = createRoute({
  method: 'put',
  path: '/leave/policy',
  tags: ['Leave Quota'],
  summary: 'Terapkan kebijakan/SK kuota satu tahun (admin)',
  security: [{ bearerAuth: [] }],
  request: { body: json(PolicyWriteSchema) },
  responses: {
    200: {
      description: 'Kebijakan diterapkan',
      ...json(ok(z.record(z.any()), 'LeavePolicyWriteResponse')),
    },
    ...errorResponses({ 400: 'Sudah diterapkan', 401: 'Token tidak valid', 403: 'Bukan admin' }),
  },
});

export const quotaBookPrintRoute = createRoute({
  method: 'get',
  path: '/leave/quota/book/{user_id}',
  tags: ['Leave Quota'],
  summary: 'Data cetak buku cuti satu pegawai (projection + identitas + kop)',
  security: [{ bearerAuth: [] }],
  request: { params: MeOrIdParamSchema },
  responses: {
    200: {
      description: 'Data buku cuti',
      ...json(ok(z.record(z.any()), 'QuotaBookPrintResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan pemilik', 404: 'Tidak ditemukan' }),
  },
});

export const quotaStoredRoute = createRoute({
  method: 'get',
  path: '/leave/quota/stored/{user_id}',
  tags: ['Leave Quota'],
  summary: 'Saldo kuota tersimpan (projection)',
  security: [{ bearerAuth: [] }],
  request: { params: MeOrIdParamSchema },
  responses: {
    200: {
      description: 'Saldo tersimpan per tahun',
      ...json(ok(z.array(StoredQuotaSchema), 'StoredQuotaResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid' }),
  },
});

export const quotaRebuildRoute = createRoute({
  method: 'post',
  path: '/leave/quota/rebuild/{user_id}',
  tags: ['Leave Quota'],
  summary: 'Rebuild projection kuota dari histori permohonan',
  security: [{ bearerAuth: [] }],
  request: { body: json(RebuildSchema), params: MeOrIdParamSchema },
  responses: {
    200: {
      description: 'Hasil rebuild',
      ...json(ok(z.record(z.any()), 'QuotaRebuildResponse')),
    },
    ...errorResponses({ 422: 'Validasi gagal' }),
  },
});

export const rolloverRoute = createRoute({
  method: 'post',
  path: '/leave/quota/rollover',
  tags: ['Leave Quota'],
  summary: 'Hitung ulang projection seluruh pegawai untuk satu tahun (bawa sisa)',
  security: [{ bearerAuth: [] }],
  request: { body: json(z.object({ year: z.number().int() })) },
  responses: {
    200: {
      description: 'Hasil rollover',
      ...json(ok(z.record(z.any()), 'QuotaRolloverResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan admin' }),
  },
});

export const QuotaAdjustmentSchema = z.object({
  user_id: z.number().int().positive(),
  year: z.number().int(),
  days: z.number().int().refine((v) => v !== 0, 'Tidak boleh 0'),
  /** Bucket yang dikoreksi: n = tahun berjalan, n1/n2 = jatah bawaan. */
  bucket: z.enum(['n', 'n1', 'n2']).optional(),
  reason: z.string().max(255).optional(),
}).openapi('QuotaAdjustment');

export const quotaAdjustmentRoute = createRoute({
  method: 'post',
  path: '/leave/quota/adjustment',
  tags: ['Leave Quota'],
  summary: 'Penyesuaian kuota manual oleh admin',
  security: [{ bearerAuth: [] }],
  request: { body: json(QuotaAdjustmentSchema) },
  responses: {
    200: {
      description: 'Kuota disesuaikan',
      ...json(ok(z.record(z.any()), 'QuotaAdjustmentResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan admin', 422: 'Validasi gagal' }),
  },
});

export const quotaAdjustmentListRoute = createRoute({
  method: 'get',
  path: '/leave/quota/adjustment/{user_id}',
  tags: ['Leave Quota'],
  summary: 'Daftar penyesuaian kuota manual satu pegawai',
  security: [{ bearerAuth: [] }],
  request: { params: MeOrIdParamSchema, query: YearQuerySchema },
  responses: {
    200: {
      description: 'Daftar penyesuaian',
      ...json(ok(z.array(z.record(z.any())), 'QuotaAdjustmentListResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid' }),
  },
});

export const quotaAdjustmentDeleteRoute = createRoute({
  method: 'delete',
  path: '/leave/quota/adjustment/{id}',
  tags: ['Leave Quota'],
  summary: 'Batalkan penyesuaian kuota manual',
  security: [{ bearerAuth: [] }],
  request: { params: IdParamSchema, query: z.object({ user_id: z.coerce.number().int().positive(), year: z.coerce.number().int() }) },
  responses: {
    200: {
      description: 'Penyesuaian dibatalkan',
      ...json(ok(z.null(), 'QuotaAdjustmentDeleteResponse')),
    },
    ...errorResponses({ 404: 'Tidak ditemukan' }),
  },
});

export const EligibilityOverrideSchema = z.object({
  user_id: z.number().int().positive(),
  year: z.number().int(),
  active: z.boolean(),
  reason: z.string().max(255).optional(),
}).openapi('EligibilityOverride');

export const eligibilityOverrideRoute = createRoute({
  method: 'post',
  path: '/leave/quota/eligibility-override',
  tags: ['Leave Quota'],
  summary: 'Admin menyatakan pegawai layak cuti (atau membatalkannya)',
  security: [{ bearerAuth: [] }],
  request: { body: json(EligibilityOverrideSchema) },
  responses: {
    200: {
      description: 'Validasi manual tersimpan',
      ...json(ok(z.record(z.any()), 'EligibilityOverrideResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan admin', 422: 'Alasan wajib diisi' }),
  },
});

// ---------------------------------------------------------------------------
// Surat keterangan cuti
// ---------------------------------------------------------------------------

export const LetterParamSchema = z.object({ id: z.coerce.number().int().positive() });

export const lettersListRoute = createRoute({
  method: 'get',
  path: '/leave/letters',
  tags: ['Leave Letters'],
  summary: 'Daftar surat keterangan cuti',
  security: [{ bearerAuth: [] }],
  request: { query: z.object({
    letter_type: z.string().optional(),
    search: z.string().optional(),
    page: z.coerce.number().int().positive().optional(),
    per_page: z.coerce.number().int().positive().max(200).optional(),
  }) },
  responses: {
    200: {
      description: 'Daftar surat',
      ...json(ok(z.record(z.any()), 'LeaveLettersResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid' }),
  },
});

export const lettersByRequestRoute = createRoute({
  method: 'get',
  path: '/leave-requests/{id}/letters',
  tags: ['Leave Letters'],
  summary: 'Surat keterangan milik satu permohonan',
  security: [{ bearerAuth: [] }],
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: 'Daftar surat permohonan',
      ...json(ok(z.array(z.record(z.any())), 'LeaveRequestLettersResponse')),
    },
    ...errorResponses({ 404: 'Tidak ditemukan' }),
  },
});

export const IssueLetterSchema = z.object({
  letter_type: z.enum(['suket', 'suket_madrasah']).default('suket'),
  number: z.string().max(100).optional(),
  issued_at: DateSchema.optional(),
  official_position: z.string().max(150).optional(),
  official_name: z.string().max(150).optional(),
}).openapi('IssueLeaveLetter');

export const issueLetterRoute = createRoute({
  method: 'post',
  path: '/leave-requests/{id}/letters',
  tags: ['Leave Letters'],
  summary: 'Terbitkan surat keterangan (nomor otomatis bila kosong)',
  security: [{ bearerAuth: [] }],
  request: {
    params: IdParamSchema,
    body: {
      content: {
        'application/json': { schema: IssueLetterSchema },
        'multipart/form-data': { schema: IssueLetterSchema.extend({ file: z.any().optional() }) },
      },
    },
  },
  responses: {
    200: {
      description: 'Surat diterbitkan',
      ...json(ok(z.record(z.any()), 'IssueLeaveLetterResponse')),
    },
    ...errorResponses({ 400: 'Belum final', 404: 'Tidak ditemukan', 422: 'Validasi gagal' }),
  },
});

export const letterFileRoute = createRoute({
  method: 'post',
  path: '/leave/letters/{id}/file',
  tags: ['Leave Letters'],
  summary: 'Unggah/ganti berkas SK surat keterangan',
  security: [{ bearerAuth: [] }],
  request: {
    params: LetterParamSchema,
    body: {
      content: {
        'multipart/form-data': { schema: z.object({ file: z.any() }) },
      },
    },
  },
  responses: {
    200: {
      description: 'Berkas tersimpan',
      ...json(ok(z.record(z.any()), 'LetterFileResponse')),
    },
    ...errorResponses({ 404: 'Tidak ditemukan', 422: 'Berkas tidak valid' }),
  },
});

export const revokeLetterRoute = createRoute({
  method: 'delete',
  path: '/leave-requests/{id}/letters/{letter_type}',
  tags: ['Leave Letters'],
  summary: 'Cabut surat keterangan',
  security: [{ bearerAuth: [] }],
  request: { params: IdParamSchema.extend({ letter_type: z.enum(['suket', 'suket_madrasah']) }) },
  responses: {
    200: {
      description: 'Surat dicabut',
      ...json(ok(z.null(), 'RevokeLeaveLetterResponse')),
    },
    ...errorResponses({ 404: 'Tidak ditemukan' }),
  },
});

// ---------------------------------------------------------------------------
// Administrasi cuti (admin)
// ---------------------------------------------------------------------------

export const instanceProfileRoute = createRoute({
  method: 'get',
  path: '/leave/admin/instance',
  tags: ['Leave Admin'],
  summary: 'Identitas instansi (dipakai kop surat dan header)',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Identitas instansi',
      ...json(ok(z.record(z.any()), 'InstanceProfileResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid' }),
  },
});

export const InstanceProfileWriteSchema = z.object({
  name: z.string().max(150).nullable().optional(),
  address: z.string().max(255).nullable().optional(),
  logo: z.string().max(255).nullable().optional(),
  website: z.string().max(150).nullable().optional(),
  status: z.string().max(100).nullable().optional(),
  head_name: z.string().max(150).nullable().optional(),
  head_nip: z.string().max(18).nullable().optional(),
});

export const instanceProfileWriteRoute = createRoute({
  method: 'put',
  path: '/leave/admin/instance',
  tags: ['Leave Admin'],
  summary: 'Ubah identitas instansi',
  security: [{ bearerAuth: [] }],
  request: { body: json(InstanceProfileWriteSchema) },
  responses: {
    200: {
      description: 'Identitas tersimpan',
      ...json(ok(z.record(z.any()), 'InstanceProfileWriteResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan admin' }),
  },
});

export const ClosurePeriodSchema = z.object({
  year: z.number().int(),
  start_date: DateSchema,
  end_date: DateSchema,
  enabled: z.boolean().optional(),
  message: z.string().max(255).nullable().optional(),
}).openapi('ClosurePeriod');

export const closurePeriodsListRoute = createRoute({
  method: 'get',
  path: '/leave/admin/closure-periods',
  tags: ['Leave Admin'],
  summary: 'Daftar periode tutup pengajuan cuti tahunan',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Daftar periode',
      ...json(ok(z.array(z.record(z.any())), 'ClosurePeriodsResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid' }),
  },
});

export const closurePeriodCreateRoute = createRoute({
  method: 'post',
  path: '/leave/admin/closure-periods',
  tags: ['Leave Admin'],
  summary: 'Tambah periode tutup',
  security: [{ bearerAuth: [] }],
  request: { body: json(ClosurePeriodSchema) },
  responses: {
    200: {
      description: 'Periode dibuat',
      ...json(ok(z.object({ id: z.number() }), 'ClosurePeriodCreateResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan admin', 422: 'Validasi gagal' }),
  },
});

export const closurePeriodUpdateRoute = createRoute({
  method: 'patch',
  path: '/leave/admin/closure-periods/{id}',
  tags: ['Leave Admin'],
  summary: 'Ubah periode tutup',
  security: [{ bearerAuth: [] }],
  request: { params: IdParamSchema, body: json(ClosurePeriodSchema.partial()) },
  responses: {
    200: {
      description: 'Periode diperbarui',
      ...json(ok(z.object({ id: z.number() }), 'ClosurePeriodUpdateResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan admin', 404: 'Tidak ditemukan' }),
  },
});

export const closurePeriodDeleteRoute = createRoute({
  method: 'delete',
  path: '/leave/admin/closure-periods/{id}',
  tags: ['Leave Admin'],
  summary: 'Hapus periode tutup',
  security: [{ bearerAuth: [] }],
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: 'Periode dihapus',
      ...json(ok(z.null(), 'ClosurePeriodDeleteResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan admin', 404: 'Tidak ditemukan' }),
  },
});

export const quotaBookRoute = createRoute({
  method: 'get',
  path: '/leave/admin/quota-book',
  tags: ['Leave Admin'],
  summary: 'Buku cuti: saldo seluruh pegawai satu tahun',
  security: [{ bearerAuth: [] }],
  request: { query: z.object({
    year: z.coerce.number().int().optional(),
    search: z.string().optional(),
    page: z.coerce.number().int().positive().optional(),
    per_page: z.coerce.number().int().positive().max(500).optional(),
  }) },
  responses: {
    200: {
      description: 'Buku cuti',
      ...json(ok(z.record(z.any()), 'QuotaBookResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan admin' }),
  },
});

export const userDirectoryRoute = createRoute({
  method: 'get',
  path: '/leave/admin/users',
  tags: ['Leave Admin'],
  summary: 'Daftar pegawai (untuk kelola kuota)',
  security: [{ bearerAuth: [] }],
  request: { query: z.object({
    search: z.string().optional(),
    page: z.coerce.number().int().positive().optional(),
    per_page: z.coerce.number().int().positive().max(200).optional(),
  }) },
  responses: {
    200: {
      description: 'Daftar pegawai',
      ...json(ok(z.record(z.any()), 'LeaveUserDirectoryResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan admin' }),
  },
});

export const quotaAuditTrailRoute = createRoute({
  method: 'get',
  path: '/leave/admin/quota-audit',
  tags: ['Leave Admin'],
  summary: 'Riwayat mutasi kuota lintas pegawai',
  security: [{ bearerAuth: [] }],
  request: { query: z.object({
    action: z.string().optional(),
    year: z.coerce.number().int().optional(),
    limit: z.coerce.number().int().positive().max(500).optional(),
  }) },
  responses: {
    200: {
      description: 'Riwayat mutasi',
      ...json(ok(z.array(z.record(z.any())), 'QuotaAuditTrailResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan admin' }),
  },
});

export const pppkTmtRoute = createRoute({
  method: 'get',
  path: '/leave/admin/pppk-tmt',
  tags: ['Leave Admin'],
  summary: 'TMT PPPK: yang sudah tercatat dan yang belum divalidasi',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Ringkasan TMT PPPK',
      ...json(ok(z.record(z.any()), 'PppkTmtResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan admin' }),
  },
});

export const pppkTmtWriteRoute = createRoute({
  method: 'put',
  path: '/leave/admin/pppk-tmt',
  tags: ['Leave Admin'],
  summary: 'Catat atau koreksi TMT PPPK satu pegawai',
  security: [{ bearerAuth: [] }],
  request: { body: json(z.object({
    nip: z.string().min(1).max(18),
    tmt_date: DateSchema.nullable(),
  })) },
  responses: {
    200: {
      description: 'TMT tersimpan',
      ...json(ok(z.record(z.any()), 'PppkTmtWriteResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan admin', 422: 'Validasi gagal' }),
  },
});

/**
 * Rekap tahunan untuk dasbor admin — cerminan counter `admin.php:240-265`
 * (Pengajuan / Diterima / Ditolak / Dibatalkan per tahun).
 */
export const leaveYearlySummaryRoute = createRoute({
  method: 'get',
  path: '/leave/admin/yearly-summary',
  tags: ['Leave Admin'],
  summary: 'Rekap jumlah permohonan per tahun (pengajuan/diterima/ditolak/dibatalkan)',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Rekap tahunan',
      ...json(ok(z.array(z.record(z.any())), 'LeaveYearlySummaryResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan admin' }),
  },
});

/** Riwayat cuti pra-2020 hasil migrasi `tbl_n2019` (buku cuti lama). */
export const leaveLegacyHistoryRoute = createRoute({
  method: 'get',
  path: '/leave/legacy-history',
  tags: ['Leave'],
  summary: 'Riwayat cuti pra-2020 (hasil migrasi tbl_n2019)',
  security: [{ bearerAuth: [] }],
  request: { query: z.object({
    user_id: z.coerce.number().int().positive().optional(),
    year: z.coerce.number().int().optional(),
  }) },
  responses: {
    200: {
      description: 'Riwayat cuti lama',
      ...json(ok(z.array(z.record(z.any())), 'LeaveLegacyHistoryResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid' }),
  },
});

export const LeaveExportQuerySchema = z.object({
  date_from: DateSchema.optional(),
  date_to: DateSchema.optional(),
  leave_type: z.string().optional(),
  /** Status permohonan yang diikutkan, pisah koma (`approved,rejected`). */
  status: z.string().optional(),
  letter_status: z.enum(['with', 'without']).optional(),
  search: z.string().optional(),
});

/**
 * Ekspor permohonan cuti (legacy: unduhan Excel super admin di
 * `transaksi_surat_masuk.php`). Formatnya CSV agar bisa dibuka Excel tanpa
 * pustaka tambahan; `format=xlsx` disediakan sebagai alias perilaku yang sama.
 */
export const leaveExportRoute = createRoute({
  method: 'get',
  path: '/leave/admin/export',
  tags: ['Leave Admin'],
  summary: 'Ekspor permohonan cuti (CSV) dengan filter tanggal/status/jenis/SK',
  security: [{ bearerAuth: [] }],
  request: {
    query: LeaveExportQuerySchema.extend({
      format: z.enum(['csv', 'xlsx']).optional(),
    }),
  },
  responses: {
    200: {
      description: 'Berkas CSV',
      content: {
        'text/csv': { schema: z.string() },
      },
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan admin', 422: 'Validasi gagal' }),
  },
});
