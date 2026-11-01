import { z } from '@hono/zod-openapi';
import { paginated } from '../../../shared/openapi';
import {
  ApiErrorSchema,
  LeaveRequestSchema,
  QuotaBucketSchema,
  QuotaResponseSchema,
  StoredQuotaSchema,
} from './shared';

/**
 * Schema request/response modul cuti.
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

export const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD');

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
  approver_level: z.coerce.number().pipe(z.union([z.literal(1), z.literal(2)])).optional(),
  approver_status: z.enum(['pending', 'accepted', 'rejected']).optional(),
  approver_nip: z.string().optional(),
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

export const QuotaAdjustmentSchema = z.object({
  user_id: z.number().int().positive(),
  year: z.number().int(),
  days: z.number().int().refine((v) => v !== 0, 'Tidak boleh 0'),
  /** Bucket yang dikoreksi: n = tahun berjalan, n1/n2 = jatah bawaan. */
  bucket: z.enum(['n', 'n1', 'n2']).optional(),
  reason: z.string().max(255).optional(),
}).openapi('QuotaAdjustment');

export const EligibilityOverrideSchema = z.object({
  user_id: z.number().int().positive(),
  year: z.number().int(),
  active: z.boolean(),
  reason: z.string().max(255).optional(),
}).openapi('EligibilityOverride');

export const LetterParamSchema = z.object({ id: z.coerce.number().int().positive() });

export const IssueLetterSchema = z.object({
  letter_type: z.enum(['suket', 'suket_madrasah']).default('suket'),
  number: z.string().max(100).optional(),
  issued_at: DateSchema.optional(),
  official_position: z.string().max(150).optional(),
  official_name: z.string().max(150).optional(),
}).openapi('IssueLeaveLetter');

export const InstanceProfileWriteSchema = z.object({
  name: z.string().max(150).nullable().optional(),
  address: z.string().max(255).nullable().optional(),
  logo: z.string().max(255).nullable().optional(),
  website: z.string().max(150).nullable().optional(),
  status: z.string().max(100).nullable().optional(),
  head_name: z.string().max(150).nullable().optional(),
  head_nip: z.string().max(18).nullable().optional(),
});

export const ClosurePeriodSchema = z.object({
  year: z.number().int(),
  start_date: DateSchema,
  end_date: DateSchema,
  enabled: z.boolean().optional(),
  message: z.string().max(255).nullable().optional(),
}).openapi('ClosurePeriod');

export const LeaveExportQuerySchema = z.object({
  date_from: DateSchema.optional(),
  date_to: DateSchema.optional(),
  leave_type: z.string().optional(),
  /** Status permohonan yang diikutkan, pisah koma (`approved,rejected`). */
  status: z.string().optional(),
  letter_status: z.enum(['with', 'without']).optional(),
  search: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Model Request & Response Tambahan
// ---------------------------------------------------------------------------

export const LeaveRequestListResponseSchema = paginated(LeaveRequestSchema, 'LeaveRequestListResponse');

export const ApprovalSummaryQuerySchema = z.object({
  approver_nip: z.string().optional(),
}).openapi('ApprovalSummaryQuery');

export const ApprovalSummaryResponseSchema = z.object({
  all_pending: z.number().int().nonnegative(),
  atasan_1: z.number().int().nonnegative(),
  atasan_2: z.number().int().nonnegative(),
  admin: z.number().int().nonnegative(),
  approved: z.number().int().nonnegative(),
  my_pending: z.number().int().nonnegative(),
  my_atasan_1: z.number().int().nonnegative(),
  my_atasan_2: z.number().int().nonnegative(),
}).openapi('ApprovalSummaryResponse');

export const LeaveStatisticsQuerySchema = z.object({
  user_id: z.coerce.number().int().positive().optional(),
  year: z.coerce.number().int().optional(),
}).openapi('LeaveStatisticsQuery');

export const LeaveStatisticsBucketSchema = z.object({
  key: z.string(),
  total: z.number(),
  days: z.number(),
});

export const LeaveStatisticsResponseSchema = z.object({
  by_status: z.array(LeaveStatisticsBucketSchema),
  by_type: z.array(LeaveStatisticsBucketSchema),
  by_archive: z.record(z.string(), z.number()),
}).openapi('LeaveStatisticsResponse');

export const LeaveTypeOptionItemSchema = z.object({
  name: z.string(),
  units: z.array(z.string()).readonly(),
  max_days: z.number(),
  consumes_quota: z.boolean(),
  requires_attachment: z.boolean(),
  subject_to_closure: z.boolean(),
  description: z.string(),
});

export const LeaveTypeOptionsResponseSchema = z.object({
  is_pppk: z.boolean(),
  types: z.array(LeaveTypeOptionItemSchema),
}).openapi('LeaveTypeOptionsResponse');

export const LeaveApproverQuerySchema = z.object({
  search: z.string().optional(),
}).openapi('LeaveApproverQuery');

export const LeaveApproverItemSchema = z.object({
  id: z.number(),
  name: z.string(),
  nip: z.string(),
  position: z.string(),
  role: z.string(),
}).openapi('LeaveApproverItem');

export const LeaveApproverListResponseSchema = z.array(LeaveApproverItemSchema).openapi('LeaveApproverListResponse');

export const LeaveRequestDetailResponseSchema = LeaveRequestSchema.extend({
  service_years: z.string().nullable().optional(),
  letters: z.array(z.record(z.string(), z.unknown())).optional(),
  attachments: z.array(z.record(z.string(), z.unknown())).optional(),
  instance: z.record(z.string(), z.unknown()).nullable().optional(),
  verify_code: z.string().optional(),
}).openapi('LeaveRequestDetailResponse');

export const LeaveQuotaAvailableQuerySchema = z.object({
  user_id: z.union([z.literal('me'), z.coerce.number().int().positive()]).optional(),
  year: z.coerce.number().int().optional(),
}).openapi('LeaveQuotaAvailableQuery');

export const LeavePolicyResponseSchema = z.object({
  id: z.number().optional(),
  year: z.number().optional(),
  default_days: z.number().optional(),
  days_after_sk: z.number().optional(),
  sk_applied: z.number().optional(),
  sk_applied_at: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  carry_over_max_n1: z.number().optional(),
  carry_over_max_n2: z.number().optional(),
  min_service_months: z.number().optional(),
}).passthrough().openapi('LeavePolicyResponse');

export const LeavePolicyWriteResponseSchema = z.object({
  year: z.number(),
  applied: z.boolean(),
  default_days: z.number(),
}).openapi('LeavePolicyWriteResponse');

export const QuotaHistoryResponseSchema = z.array(
  z.object({
    id: z.number().optional(),
    user_id: z.number().optional(),
    year: z.number().optional(),
    action: z.string().optional(),
    before_data: z.unknown().optional(),
    after_data: z.unknown().optional(),
    actor_id: z.number().nullable().optional(),
    reason: z.string().nullable().optional(),
    created_at: z.string().optional(),
  }).passthrough()
).openapi('QuotaHistoryResponse');

export const QuotaBookPrintResponseSchema = z.object({
  user: z.record(z.string(), z.unknown()).optional(),
  instance: z.record(z.string(), z.unknown()).optional(),
  years: z.array(z.record(z.string(), z.unknown())).optional(),
  current: z.record(z.string(), z.unknown()).optional(),
}).passthrough().openapi('QuotaBookPrintResponse');

export const StoredQuotaResponseSchema = z.array(StoredQuotaSchema).openapi('StoredQuotaResponse');

export const QuotaRebuildResponseSchema = z.object({
  year: z.number(),
  user_id: z.number().optional(),
  quota: z.record(z.string(), z.unknown()).optional(),
  total: z.number().optional(),
  success: z.number().optional(),
  failed: z.number().optional(),
}).passthrough().openapi('QuotaRebuildResponse');

export const QuotaRolloverBodySchema = z.object({
  year: z.number().int(),
}).openapi('QuotaRolloverBody');

export const QuotaRolloverResponseSchema = z.object({
  year: z.number(),
  success: z.number(),
  failed: z.number(),
  errors: z.array(z.string()),
}).openapi('QuotaRolloverResponse');

export const QuotaAdjustmentResponseSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  year: z.number(),
  days: z.number(),
  quota: z.record(z.string(), z.unknown()).optional(),
}).openapi('QuotaAdjustmentResponse');

export const QuotaAdjustmentListResponseSchema = z.array(
  z.record(z.string(), z.unknown())
).openapi('QuotaAdjustmentListResponse');

export const QuotaAdjustmentDeleteQuerySchema = z.object({
  user_id: z.coerce.number().int().positive(),
  year: z.coerce.number().int(),
}).openapi('QuotaAdjustmentDeleteQuery');

export const EligibilityOverrideResponseSchema = z.object({
  user_id: z.number(),
  year: z.number(),
  active: z.boolean(),
  quota: z.record(z.string(), z.unknown()).optional(),
}).openapi('EligibilityOverrideResponse');

export const LeavePdfResponseSchema = z.object({
  document_id: z.number(),
  verify_url: z.string(),
  url: z.string().optional(),
}).openapi('LeavePdfResponse');

export const LeaveFormPdfResponseSchema = z.object({
  document_id: z.number(),
  url: z.string(),
}).openapi('LeaveFormPdfResponse');

export const CreateLeaveRequestFormSchema = CreateLeaveRequestSchema.extend({
  file: z.instanceof(File).optional().openapi({ type: 'string', format: 'binary' }),
}).openapi('CreateLeaveRequestForm');

export const CreateLeaveResponseSchema = z.object({
  id: z.number(),
  attachment_id: z.number().nullable(),
}).openapi('CreateLeaveResponse');

export const UpdateLeaveResponseSchema = z.object({
  id: z.number(),
}).openapi('UpdateLeaveResponse');

export const AdminDecisionResponseSchema = z.object({
  id: z.number(),
  status: z.string(),
}).openapi('AdminDecisionResponse');

export const ApproveLevelParamSchema = IdParamSchema.extend({
  level: z.coerce.number().int().min(1).max(2),
}).openapi('ApproveLevelParam');

export const LevelDecisionResponseSchema = z.object({
  id: z.number(),
  status: z.string(),
  repeated: z.boolean().optional(),
}).openapi('LevelDecisionResponse');

export const CancelLeaveResponseSchema = z.object({
  id: z.number(),
}).openapi('CancelLeaveResponse');

export const LeaveLettersQuerySchema = z.object({
  letter_type: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  per_page: z.coerce.number().int().positive().max(200).optional(),
}).openapi('LeaveLettersQuery');

export const LeaveLetterItemSchema = z.object({
  id: z.number(),
  leave_request_id: z.number(),
  letter_type: z.string(),
  number: z.string(),
  issued_at: z.string().nullable().optional(),
  official_position: z.string().nullable().optional(),
  official_name: z.string().nullable().optional(),
  document_id: z.number().nullable().optional(),
  display_number: z.string().optional(),
}).passthrough().openapi('LeaveLetterItem');

export const LeaveLettersResponseSchema = z.object({
  items: z.array(LeaveLetterItemSchema),
  page: z.number(),
  per_page: z.number(),
}).openapi('LeaveLettersResponse');

export const LeaveRequestLettersResponseSchema = z.array(
  z.record(z.string(), z.unknown())
).openapi('LeaveRequestLettersResponse');

export const IssueLeaveLetterFormSchema = IssueLetterSchema.extend({
  file: z.instanceof(File).optional().openapi({ type: 'string', format: 'binary' }),
}).openapi('IssueLeaveLetterForm');

export const IssueLeaveLetterResponseSchema = z.object({
  id: z.number(),
  number: z.string(),
  document_id: z.number().nullable(),
}).openapi('IssueLeaveLetterResponse');

export const UploadLetterFileFormSchema = z.object({
  file: z.instanceof(File).openapi({ type: 'string', format: 'binary' }),
}).openapi('UploadLetterFileForm');

export const LetterFileResponseSchema = z.object({
  id: z.number(),
  document_id: z.number(),
}).openapi('LetterFileResponse');

export const RevokeLetterParamSchema = IdParamSchema.extend({
  letter_type: z.enum(['suket', 'suket_madrasah']),
}).openapi('RevokeLetterParam');

export const InstanceProfileResponseSchema = z.record(z.string(), z.string().nullable()).openapi('InstanceProfileResponse');
export const InstanceProfileWriteResponseSchema = z.record(z.string(), z.string().nullable()).openapi('InstanceProfileWriteResponse');

export const ClosurePeriodItemSchema = z.object({
  id: z.number(),
  year: z.number(),
  start_date: z.string(),
  end_date: z.string(),
  enabled: z.number(),
  message: z.string().nullable(),
}).openapi('ClosurePeriodItem');

export const ClosurePeriodsResponseSchema = z.array(
  z.record(z.string(), z.unknown())
).openapi('ClosurePeriodsResponse');

export const ClosurePeriodCreateResponseSchema = z.object({
  id: z.number(),
}).openapi('ClosurePeriodCreateResponse');

export const ClosurePeriodUpdateResponseSchema = z.object({
  id: z.number(),
}).openapi('ClosurePeriodUpdateResponse');

export const QuotaBookQuerySchema = z.object({
  year: z.coerce.number().int().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  per_page: z.coerce.number().int().positive().max(500).optional(),
}).openapi('QuotaBookQuery');

export const QuotaBookResponseSchema = z.object({
  year: z.number(),
  items: z.array(z.record(z.string(), z.unknown())),
  summary: z.record(z.string(), z.unknown()).optional(),
}).passthrough().openapi('QuotaBookResponse');

export const LeaveUserDirectoryQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  per_page: z.coerce.number().int().positive().max(200).optional(),
}).openapi('LeaveUserDirectoryQuery');

export const LeaveUserDirectoryResponseSchema = paginated(
  z.record(z.string(), z.unknown()),
  'LeaveUserDirectoryResponse'
);

export const QuotaAuditTrailQuerySchema = z.object({
  action: z.string().optional(),
  year: z.coerce.number().int().optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
}).openapi('QuotaAuditTrailQuery');

export const QuotaAuditTrailResponseSchema = z.array(
  z.object({
    id: z.number().optional(),
    user_id: z.number().optional(),
    year: z.number().optional(),
    action: z.string().optional(),
    after_data: z.unknown().optional(),
    actor_id: z.number().nullable().optional(),
    reason: z.string().nullable().optional(),
    created_at: z.string().optional(),
  }).passthrough()
).openapi('QuotaAuditTrailResponse');

export const PppkTmtResponseSchema = z.object({
  recorded: z.array(z.record(z.string(), z.unknown())),
  missing: z.array(z.record(z.string(), z.unknown())),
}).openapi('PppkTmtResponse');

export const PppkTmtWriteSchema = z.object({
  nip: z.string().min(1).max(18),
  tmt_date: DateSchema.nullable(),
}).openapi('PppkTmtWrite');

export const PppkTmtWriteResponseSchema = z.object({
  nip: z.string(),
  tmt_date: z.string().nullable(),
}).openapi('PppkTmtWriteResponse');
export const LeaveYearlySummaryResponseSchema = z.array(
  z.object({
    year: z.number(),
    submitted: z.number(),
    approved: z.number(),
    rejected: z.number(),
    cancelled: z.number(),
    total: z.number(),
  })
).openapi('LeaveYearlySummaryResponse');

export const LeaveLegacyHistoryQuerySchema = z.object({
  user_id: z.coerce.number().int().positive().optional(),
  year: z.coerce.number().int().optional(),
}).openapi('LeaveLegacyHistoryQuery');

export const LeaveLegacyHistoryResponseSchema = z.array(
  z.object({
    id: z.number().optional(),
    user_id: z.number().optional(),
    year: z.number().optional(),
    days: z.number().optional(),
    leave_type: z.string().optional(),
    notes: z.string().nullable().optional(),
  }).passthrough()
).openapi('LeaveLegacyHistoryResponse');

export const LeaveExportWithFormatQuerySchema = LeaveExportQuerySchema.extend({
  format: z.enum(['csv', 'xlsx']).optional(),
}).openapi('LeaveExportWithFormatQuery');

export const ExportCsvResponseSchema = z.string().openapi({
  type: 'string',
  format: 'binary',
  description: 'Berkas CSV',
});

export {
  ApiErrorSchema,
  LeaveRequestSchema,
  QuotaBucketSchema,
  QuotaResponseSchema,
  StoredQuotaSchema,
};
