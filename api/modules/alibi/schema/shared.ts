import { z } from 'zod';
export { ApiErrorSchema, errorResponses, json, ok } from '../../../shared/openapi';

/** Potongan schema OpenAPI yang dipakai modul alibi. */

/** Baris ringkas untuk tabel daftar alibi. */
export const AlibiRequestSchema = z
  .object({
    id: z.number(),
    user_id: z.number(),
    name: z.string(),
    nip: z.string().nullable(),
    alibi_type: z.string().nullable(),
    alibi_date: z.string().nullable(),
    day_count: z.string().nullable(),
    status: z.string(),
    admin_decision: z.string(),
    approver_1_status: z.string(),
    approver_2_status: z.string(),
  })
  .openapi('AlibiRequest');
