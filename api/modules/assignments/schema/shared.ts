import { z } from 'zod';

/** Potongan schema OpenAPI yang dipakai modul surat tugas. */

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
