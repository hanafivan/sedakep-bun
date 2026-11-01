import { z } from '@hono/zod-openapi';
import { paginated } from '../../../shared/openapi';
import { AgendaSchema } from './shared';

export { AgendaSchema };

const DateTimeSchema = z.string().min(4).max(30);

export const AgendaInputSchema = z
  .object({
    title: z.string().min(1).max(2000),
    place: z.string().max(2000).optional(),
    start_at: DateTimeSchema.optional(),
    end_at: DateTimeSchema.optional(),
    report: z.string().max(8000).optional(),
  })
  .openapi('AgendaInput');

export const AgendaUpdateSchema = AgendaInputSchema.partial().openapi('AgendaUpdate');

export const AgendaReportSchema = z
  .object({ report: z.string().min(1).max(8000) })
  .openapi('AgendaReport');

export const IdParamSchema = z.object({ id: z.coerce.number().int().positive() });

export const AgendaListQuerySchema = z.object({
  user_id: z.coerce.number().int().positive().optional(),
  year: z.coerce.number().int().optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  per_page: z.coerce.number().int().positive().max(200).optional(),
});

export const AgendaListResponseSchema = paginated(AgendaSchema, 'AgendaListResponse');
export const AgendaCreateResponseSchema = z.record(z.any()).openapi('AgendaCreateResponse');
export const AgendaDetailResponseSchema = z.record(z.any()).openapi('AgendaDetailResponse');
export const AgendaUpdateResponseSchema = z.record(z.any()).openapi('AgendaUpdateResponse');
export const AgendaReportResponseSchema = z.record(z.any()).openapi('AgendaReportResponse');
export const UploadAgendaFileSchema = z.object({ file: z.any() }).openapi('UploadAgendaFile');
export const AgendaFileResponseSchema = z.record(z.any()).openapi('AgendaFileResponse');
