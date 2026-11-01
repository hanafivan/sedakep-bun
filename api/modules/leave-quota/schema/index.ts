import { z } from '@hono/zod-openapi';

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD');

export const IdParamSchema = z.object({ id: z.coerce.number().int().positive() });
export const YearQuerySchema = z.object({ year: z.coerce.number().int().optional() });
export const QuotaQuerySchema = z.object({
  user_id: z.coerce.number().int().positive().optional(),
  year: z.coerce.number().int().optional(),
});

export const MeOrIdParamSchema = z.object({
  user_id: z.union([z.literal('me'), z.coerce.number().int().positive()]),
});

export const QuotaBucketSchema = z.object({
  n: z.number(),
  n1: z.number(),
  n2: z.number(),
  total: z.number(),
}).openapi('QuotaBucket');

export const QuotaResponseSchema = z.object({
  year: z.number(),
  official: QuotaBucketSchema,
  reserved_days: z.number(),
  reserved_count: z.number(),
  available: QuotaBucketSchema,
  eligibility: z.object({
    eligible: z.boolean(),
    reason: z.string(),
    months_worked: z.number(),
    is_pppk: z.boolean(),
    manual_validation: z.boolean(),
  }),
}).openapi('QuotaResponse');

export const StoredQuotaSchema = z.object({
  year: z.number(),
  remaining_n: z.number(),
  remaining_n1: z.number(),
  remaining_n2: z.number(),
  total_remaining: z.number(),
  reserved_days: z.number(),
  reserved_count: z.number(),
  eligible: z.number(),
  manual_validation: z.number(),
  computed_at: z.string().nullable(),
}).openapi('StoredQuota');

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
