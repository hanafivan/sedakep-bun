import { z } from '@hono/zod-openapi';

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD');
export const IdParamSchema = z.object({ id: z.coerce.number().int().positive() });

export const LetterParamSchema = z.object({ id: z.coerce.number().int().positive() });

export const IssueLetterSchema = z.object({
  letter_type: z.enum(['suket', 'suket_madrasah']).default('suket'),
  number: z.string().max(100).optional(),
  issued_at: DateSchema.optional(),
  official_position: z.string().max(150).optional(),
  official_name: z.string().max(150).optional(),
}).openapi('IssueLeaveLetter');

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

