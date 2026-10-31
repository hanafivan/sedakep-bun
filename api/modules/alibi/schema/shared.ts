import { z } from 'zod';

/** Potongan schema OpenAPI yang dipakai modul alibi. */

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
