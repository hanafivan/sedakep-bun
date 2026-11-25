import { z } from 'zod';
export { ApiErrorSchema, errorResponses, json, ok } from '../../../shared/openapi';

/** Potongan schema OpenAPI yang dipakai modul surat tugas. */

/** Baris ringkas untuk tabel daftar surat tugas. */
export const AssignmentLetterSchema = z
  .object({
    id: z.number(),
    user_id: z.number(),
    name: z.string(),
    nip: z.string().nullable(),
    code: z.string().nullable(),
    letter_number: z.string().nullable(),
    number_display: z.string().nullable(),
    start_date: z.string().nullable(),
    end_date: z.string().nullable(),
    place: z.string().nullable(),
    status: z.string(),
    decision: z.string(),
    decision_note: z.string().nullable(),
  })
  .openapi('AssignmentLetter');
