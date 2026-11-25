import { z } from 'zod';
export { ApiErrorSchema, errorResponses, json, ok } from '../../../shared/openapi';

/** Potongan schema OpenAPI yang dipakai modul disposisi. */

/** Baris ringkas untuk tabel daftar surat masuk. */
export const IncomingLetterSchema = z
  .object({
    id: z.number(),
    agenda_number: z.string().nullable(),
    ticket_number: z.string().nullable(),
    letter_number: z.string().nullable(),
    origin: z.string().nullable(),
    classification_code: z.string().nullable(),
    letter_date: z.string().nullable(),
    received_date: z.string().nullable(),
    status: z.string(),
    disposition_count: z.number().optional(),
  })
  .openapi('IncomingLetter');

export const LetterClassificationSchema = z
  .object({
    id: z.number(),
    code: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    is_active: z.number(),
  })
  .openapi('LetterClassification');
