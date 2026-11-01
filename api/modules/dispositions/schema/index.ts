import { z } from '@hono/zod-openapi';
import { paginated } from '../../../shared/openapi';
import {
  IncomingLetterSchema,
  LetterClassificationSchema,
} from './shared';

export { IncomingLetterSchema, LetterClassificationSchema };

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD');

export const IdParamSchema = z.object({ id: z.coerce.number().int().positive() });
export const ChildParamSchema = z.object({
  id: z.coerce.number().int().positive(),
  childId: z.coerce.number().int().positive(),
});

export const IncomingLetterInputSchema = z
  .object({
    owner_name: z.string().max(120).optional(),
    owner_nip: z.string().max(18).optional(),
    agenda_number: z.string().max(50).optional(),
    ticket_number: z.string().max(50).optional(),
    letter_number: z.string().max(100).optional(),
    origin: z.string().max(200).optional(),
    content: z.string().max(20000).optional(),
    classification_code: z.string().max(50).optional(),
    index_code: z.string().max(50).optional(),
    letter_date: DateSchema.optional(),
    received_date: DateSchema.optional(),
    notes: z.string().max(2000).optional(),
  })
  .openapi('IncomingLetterInput');

export const IncomingLetterUpdateSchema = IncomingLetterInputSchema.partial().openapi(
  'IncomingLetterUpdate',
);

export const DispositionInputSchema = z
  .object({
    target_name: z.string().max(150).optional(),
    target_nip: z.string().max(18).optional(),
    instruction: z.string().max(8000).optional(),
    notes: z.string().max(2000).optional(),
    sort_order: z.coerce.number().int().optional(),
  })
  .openapi('DispositionInput');

export const DispositionUpdateSchema = DispositionInputSchema.partial()
  .extend({ status: z.enum(['pending', 'accepted', 'done', 'rejected']).optional() })
  .openapi('DispositionUpdate');

export const DispositionFinalInputSchema = z
  .object({
    name: z.string().max(150).optional(),
    nip: z.string().max(18).optional(),
    instruction: z.string().max(8000).optional(),
  })
  .openapi('DispositionFinalInput');

export const ReferenceInputSchema = z
  .object({ reference_text: z.string().min(1).max(255) })
  .openapi('IncomingLetterReferenceInput');

export const ClassificationInputSchema = z
  .object({
    code: z.string().min(1).max(50),
    name: z.string().min(1).max(200),
    description: z.string().max(4000).optional(),
    is_active: z.boolean().optional(),
  })
  .openapi('LetterClassificationInput');

export const IncomingLetterListQuerySchema = z.object({
  status: z.string().optional(),
  year: z.coerce.number().int().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  per_page: z.coerce.number().int().positive().max(200).optional(),
});

export const ClassificationListQuerySchema = z.object({
  search: z.string().optional(),
  active_only: z.string().optional(),
});

export const IncomingLetterListResponseSchema = paginated(IncomingLetterSchema, 'IncomingLetterListResponse');
export const IncomingLetterCreateResponseSchema = z.record(z.any()).openapi('IncomingLetterCreateResponse');
export const IncomingLetterDetailResponseSchema = z.record(z.any()).openapi('IncomingLetterDetailResponse');
export const IncomingLetterUpdateResponseSchema = z.record(z.any()).openapi('IncomingLetterUpdateResponse');
export const IncomingLetterFinalizeResponseSchema = z.record(z.any()).openapi('IncomingLetterFinalizeResponse');
export const UploadIncomingLetterFileSchema = z.object({ file: z.any(), field: z.string().optional() }).openapi('UploadIncomingLetterFile');
export const IncomingLetterFileResponseSchema = z.record(z.any()).openapi('IncomingLetterFileResponse');
export const DispositionCreateResponseSchema = z.record(z.any()).openapi('DispositionCreateResponse');
export const DispositionUpdateResponseSchema = z.record(z.any()).openapi('DispositionUpdateResponse');
export const DispositionFinalCreateResponseSchema = z.record(z.any()).openapi('DispositionFinalCreateResponse');
export const ReferenceCreateResponseSchema = z.record(z.any()).openapi('ReferenceCreateResponse');
export const ClassificationListResponseSchema = z.array(LetterClassificationSchema).openapi('ClassificationListResponse');
export const ClassificationCreateResponseSchema = z.record(z.any()).openapi('ClassificationCreateResponse');
export const ClassificationUpdateResponseSchema = z.record(z.any()).openapi('ClassificationUpdateResponse');

