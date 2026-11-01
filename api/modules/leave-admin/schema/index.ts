import { z } from '@hono/zod-openapi';

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD');

export const IdParamSchema = z.object({ id: z.coerce.number().int().positive() });
export const YearQuerySchema = z.object({ year: z.coerce.number().int().positive().optional() });

export const paginated = <T extends z.ZodTypeAny>(itemSchema: T, name: string) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    per_page: z.number().int().positive(),
    total_pages: z.number().int().nonnegative(),
  }).openapi(name);

export const InstanceProfileWriteSchema = z.object({
  name: z.string().max(150).nullable().optional(),
  address: z.string().max(255).nullable().optional(),
  logo: z.string().max(255).nullable().optional(),
  website: z.string().max(150).nullable().optional(),
  status: z.string().max(100).nullable().optional(),
  head_name: z.string().max(150).nullable().optional(),
  head_nip: z.string().max(18).nullable().optional(),
});

export const InstanceProfileResponseSchema = z.record(z.string(), z.string().nullable()).openapi('InstanceProfileResponse');
export const InstanceProfileWriteResponseSchema = z.record(z.string(), z.string().nullable()).openapi('InstanceProfileWriteResponse');

export const ClosurePeriodSchema = z.object({
  year: z.number().int(),
  start_date: DateSchema,
  end_date: DateSchema,
  enabled: z.boolean().optional(),
  message: z.string().max(255).nullable().optional(),
}).openapi('ClosurePeriod');

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

export const LeaveExportQuerySchema = z.object({
  date_from: DateSchema.optional(),
  date_to: DateSchema.optional(),
  leave_type: z.string().optional(),
  status: z.string().optional(),
  letter_status: z.enum(['with', 'without']).optional(),
  search: z.string().optional(),
});

export const LeaveExportWithFormatQuerySchema = LeaveExportQuerySchema.extend({
  format: z.enum(['csv', 'xlsx']).optional(),
}).openapi('LeaveExportWithFormatQuery');

export const ExportCsvResponseSchema = z.string().openapi({
  type: 'string',
  description: 'Berkas CSV permohonan cuti',
});

