import { z } from 'zod';

/** Potongan schema OpenAPI yang dipakai modul agenda. */

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
