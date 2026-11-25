import { z } from 'zod';
export { ApiErrorSchema, errorResponses, json, ok } from '../../../shared/openapi';

/** Potongan schema OpenAPI yang dipakai modul agenda. */

/** Baris ringkas untuk tabel daftar agenda. */
export const AgendaSchema = z
  .object({
    id: z.number(),
    user_id: z.number(),
    name: z.string().nullable(),
    nip: z.string().nullable(),
    title: z.string(),
    place: z.string().nullable(),
    start_at: z.string().nullable(),
    end_at: z.string().nullable(),
    report: z.string().nullable(),
    reported_at: z.string().nullable(),
  })
  .openapi('Agenda');
