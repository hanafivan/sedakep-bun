import { z } from '@hono/zod-openapi';
import { paginated } from '../../../shared/openapi';
import { AssignmentLetterSchema } from './shared';

export { AssignmentLetterSchema };

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD');

export const AssignmentLetterInputSchema = z
  .object({
    user_id: z.coerce.number().int().positive().optional(),
    code: z.string().max(50).optional(),
    consideration: z.string().max(8000).optional(),
    legal_basis: z.string().max(8000).optional(),
    content: z.string().max(8000).optional(),
    start_date: DateSchema.optional(),
    end_date: DateSchema.optional(),
    day_start: z.string().max(30).optional(),
    day_end: z.string().max(30).optional(),
    place: z.string().max(150).optional(),
    time_start: z.string().max(10).optional(),
    time_end: z.string().max(10).optional(),
    signer_name: z.string().max(150).optional(),
    signer_position: z.string().max(150).optional(),
    footnote: z.string().max(4000).optional(),
  })
  .openapi('AssignmentLetterInput');

export const AssignmentLetterUpdateSchema = AssignmentLetterInputSchema.partial()
  .omit({ user_id: true })
  .openapi('AssignmentLetterUpdate');

export const AssignmentMemberInputSchema = z
  .object({
    name: z.string().min(1).max(150),
    nip: z.string().max(18).optional(),
    grade: z.string().max(20).optional(),
    position: z.string().max(150).optional(),
    organization_name: z.string().max(150).optional(),
    sort_order: z.coerce.number().int().optional(),
  })
  .openapi('AssignmentMemberInput');

export const AssignmentNoteInputSchema = z
  .object({
    note: z.string().min(1).max(8000),
    sort_order: z.coerce.number().int().optional(),
  })
  .openapi('AssignmentNoteInput');

export const AssignmentCopyInputSchema = z
  .object({
    copy_to: z.string().min(1).max(200),
    sort_order: z.coerce.number().int().optional(),
  })
  .openapi('AssignmentCopyInput');

export const AssignmentDecisionSchema = z
  .object({
    decision: z.enum(['accepted', 'rejected']),
    note: z.string().max(1000).optional(),
  })
  .openapi('AssignmentDecision');

export const AssignmentNumberSchema = z
  .object({ letter_number: z.string().min(1).max(100) })
  .openapi('AssignmentNumber');

export const IdParamSchema = z.object({ id: z.coerce.number().int().positive() });

export const MemberParamSchema = z.object({
  id: z.coerce.number().int().positive(),
  memberId: z.coerce.number().int().positive(),
});

export const NoteParamSchema = z.object({
  id: z.coerce.number().int().positive(),
  noteId: z.coerce.number().int().positive(),
});

export const CopyParamSchema = z.object({
  id: z.coerce.number().int().positive(),
  copyId: z.coerce.number().int().positive(),
});

export const AssignmentListQuerySchema = z.object({
  user_id: z.coerce.number().int().positive().optional(),
  status: z.string().optional(),
  year: z.coerce.number().int().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  per_page: z.coerce.number().int().positive().max(200).optional(),
});

export const AssignmentLetterListResponseSchema = paginated(AssignmentLetterSchema, 'AssignmentLetterListResponse');
export const AssignmentLetterCreateResponseSchema = z.record(z.any()).openapi('AssignmentLetterCreateResponse');
export const AssignmentLetterDetailResponseSchema = z.record(z.any()).openapi('AssignmentLetterDetailResponse');
export const AssignmentLetterUpdateResponseSchema = z.record(z.any()).openapi('AssignmentLetterUpdateResponse');
export const AssignmentCancelResponseSchema = z.record(z.any()).openapi('AssignmentCancelResponse');
export const AssignmentPdfResponseSchema = z.record(z.any()).openapi('AssignmentPdfResponse');
export const AssignmentDecisionResponseSchema = z.record(z.any()).openapi('AssignmentDecisionResponse');
export const AssignmentNumberResponseSchema = z.record(z.any()).openapi('AssignmentNumberResponse');
export const UploadAssignmentFileSchema = z.object({ file: z.any() }).openapi('UploadAssignmentFile');
export const AssignmentFileResponseSchema = z.record(z.any()).openapi('AssignmentFileResponse');
export const AssignmentMemberCreateResponseSchema = z.record(z.any()).openapi('AssignmentMemberCreateResponse');
export const AssignmentMemberUpdateResponseSchema = z.record(z.any()).openapi('AssignmentMemberUpdateResponse');
export const AssignmentNoteCreateResponseSchema = z.record(z.any()).openapi('AssignmentNoteCreateResponse');
export const AssignmentNoteUpdateResponseSchema = z.record(z.any()).openapi('AssignmentNoteUpdateResponse');
export const AssignmentCopyCreateResponseSchema = z.record(z.any()).openapi('AssignmentCopyCreateResponse');
export const AssignmentCopyUpdateResponseSchema = z.record(z.any()).openapi('AssignmentCopyUpdateResponse');

