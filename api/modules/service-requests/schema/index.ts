import { z } from '@hono/zod-openapi';
import { paginated } from '../../../shared/openapi';
import { SERVICE_TYPE_VALUES } from '../domain/service-types';
import { ServiceRequestSchema } from './shared';

export { ServiceRequestSchema };

const ServiceTypeEnum = z.enum(
  SERVICE_TYPE_VALUES as unknown as [string, ...string[]],
);
const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD');
export const IdParamSchema = z.object({ id: z.coerce.number().int().positive() });

export const ServiceRequestInputSchema = z
  .object({
    service_type: ServiceTypeEnum,
    user_id: z.coerce.number().int().positive().optional(),
    title: z.string().max(255).optional(),
    phone: z.string().max(30).optional(),
    subtype: z.string().max(50).optional(),
    approver_1_name: z.string().max(150).optional(),
    approver_1_nip: z.string().max(18).optional(),
    approver_1_position: z.string().max(150).optional(),
    fields: z.record(z.string()).optional(),
  })
  .openapi('ServiceRequestInput');

export const ServiceRequestUpdateSchema = ServiceRequestInputSchema.partial()
  .omit({ service_type: true, user_id: true })
  .openapi('ServiceRequestUpdate');

export const ServiceApproveSchema = z
  .object({
    decision: z.enum(['accepted', 'rejected', 'cancelled']),
    note: z.string().max(1000).optional(),
  })
  .openapi('ServiceRequestApprove');

export const ServiceFieldsSchema = z
  .object({ fields: z.record(z.string()) })
  .openapi('ServiceRequestFields');

export const ServiceCheckSchema = z
  .object({
    check_type: z.string().min(1).max(50),
    result: z.string().max(50).optional(),
    notes: z.string().max(2000).optional(),
  })
  .openapi('ServiceRequestCheck');

export const ServiceLetterSchema = z
  .object({
    letter_type: z.enum(['sphd', 'sppid', 'sk', 'suket']),
    number: z.string().max(100).optional(),
    issued_at: DateSchema.optional(),
  })
  .openapi('GeneratedLetter');

export const ServiceRequestListQuerySchema = z.object({
  service_type: z.string().optional(),
  status: z.string().optional(),
  user_id: z.coerce.number().int().positive().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  per_page: z.coerce.number().int().positive().max(200).optional(),
});

export const ServiceMetaResponseSchema = z.record(z.any()).openapi('ServiceMetaResponse');
export const ServiceRequestListResponseSchema = paginated(ServiceRequestSchema, 'ServiceRequestListResponse');
export const ServiceRequestCreateResponseSchema = z.record(z.any()).openapi('ServiceRequestCreateResponse');
export const ServiceRequestDetailResponseSchema = z.record(z.any()).openapi('ServiceRequestDetailResponse');
export const ServiceRequestUpdateResponseSchema = z.record(z.any()).openapi('ServiceRequestUpdateResponse');
export const ServicePdfResponseSchema = z.record(z.any()).openapi('ServicePdfResponse');
export const ServiceApproveResponseSchema = z.record(z.any()).openapi('ServiceApproveResponse');
export const ServiceFieldsResponseSchema = z.record(z.any()).openapi('ServiceFieldsResponse');
export const UploadServiceDocumentSchema = z.object({
  file: z.any(),
  label: z.string(),
}).openapi('UploadServiceDocument');
export const ServiceDocumentResponseSchema = z.record(z.any()).openapi('ServiceDocumentResponse');
export const ServiceCheckResponseSchema = z.record(z.any()).openapi('ServiceCheckResponse');
export const GeneratedLetterResponseSchema = z.record(z.any()).openapi('GeneratedLetterResponse');

