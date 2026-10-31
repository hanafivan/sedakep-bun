import { z } from 'zod';

/** Potongan schema OpenAPI yang dipakai modul disposisi. */

export const ApiErrorSchema = z
  .object({
    success: z.literal(false),
    data: z.null(),
    message: z.string(),
    code: z.number(),
    details: z.any().optional(),
  })
  .openapi('ApiError');

export const ok = <T extends z.ZodTypeAny>(data: T, name: string) =>
  z
    .object({
      success: z.literal(true),
      data,
      message: z.string(),
      code: z.number(),
    })
    .openapi(name);

export const json = <T extends z.ZodTypeAny>(schema: T) => ({
  content: { 'application/json': { schema } },
});

export const errorResponses = (descriptions: Record<number, string>) =>
  Object.fromEntries(
    Object.entries(descriptions).map(([code, description]) => [
      Number(code),
      { description, content: { 'application/json': { schema: ApiErrorSchema } } },
    ]),
  );

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
