import { z } from '@hono/zod-openapi';
import { paginated } from '../../../shared/openapi';
import { AlibiRequestSchema } from './shared';

export { AlibiRequestSchema };

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD');

export const AlibiInputSchema = z
  .object({
    user_id: z.coerce.number().int().positive().optional(),
    day_count: z.string().max(20).optional(),
    alibi_date: DateSchema.optional(),
    alibi_type: z.string().max(50).optional(),
    reason: z.string().max(1000).optional(),
    time_start: z.string().max(10).optional(),
    time_end: z.string().max(10).optional(),
    approver_1_name: z.string().max(150).optional(),
    approver_1_nip: z.string().max(18).optional(),
    approver_1_position: z.string().max(150).optional(),
    approver_2_name: z.string().max(150).optional(),
    approver_2_nip: z.string().max(18).optional(),
    approver_2_position: z.string().max(150).optional(),
  })
  .openapi('AlibiInput');

export const AlibiUpdateSchema = AlibiInputSchema.partial()
  .omit({ user_id: true })
  .openapi('AlibiUpdate');

export const AlibiAdminDecisionSchema = z
  .object({
    decision: z.enum(['accepted', 'rejected', 'cancelled']),
    note: z.string().max(1000).optional(),
  })
  .openapi('AlibiAdminDecision');

export const AlibiDecisionSchema = z
  .object({
    decision: z.enum(['accepted', 'rejected']),
    note: z.string().max(1000).optional(),
  })
  .openapi('AlibiDecision');

export const AlibiCancelSchema = z
  .object({ note: z.string().max(1000).optional() })
  .openapi('AlibiCancel');

export const IdParamSchema = z.object({ id: z.coerce.number().int().positive() });

export const LevelParamSchema = z.object({
  id: z.coerce.number().int().positive(),
  level: z.coerce.number().int().min(1).max(2),
});

export const AlibiListQuerySchema = z.object({
  user_id: z.coerce.number().int().positive().optional(),
  status: z.string().optional(),
  year: z.coerce.number().int().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  per_page: z.coerce.number().int().positive().max(200).optional(),
});

export const AlibiListResponseSchema = paginated(AlibiRequestSchema, 'AlibiListResponse');
export const AlibiCreateResponseSchema = z.record(z.any()).openapi('AlibiCreateResponse');
export const AlibiDetailResponseSchema = z.record(z.any()).openapi('AlibiDetailResponse');
export const AlibiUpdateResponseSchema = z.record(z.any()).openapi('AlibiUpdateResponse');
export const AlibiAdminDecisionResponseSchema = z.record(z.any()).openapi('AlibiAdminDecisionResponse');
export const AlibiLevelDecisionResponseSchema = z.record(z.any()).openapi('AlibiLevelDecisionResponse');
export const AlibiCancelResponseSchema = z.record(z.any()).openapi('AlibiCancelResponse');
export const UploadAlibiFileSchema = z.object({ file: z.any() }).openapi('UploadAlibiFile');
export const AlibiFileResponseSchema = z.record(z.any()).openapi('AlibiFileResponse');
