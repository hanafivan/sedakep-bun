import { z } from 'zod';
export { ApiErrorSchema, errorResponses, json, ok } from '../../../shared/openapi';

/** Potongan schema OpenAPI yang dipakai modul layanan kepegawaian. */

/** Baris ringkas untuk tabel daftar layanan. */
export const ServiceRequestSchema = z
  .object({
    id: z.number(),
    service_type: z.string(),
    user_id: z.number(),
    name: z.string(),
    nip: z.string().nullable(),
    title: z.string().nullable(),
    subtype: z.string().nullable(),
    status: z.string(),
    decision: z.string(),
    created_at: z.string(),
  })
  .openapi('ServiceRequest');
