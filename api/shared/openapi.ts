import { z } from '@hono/zod-openapi';

export const ApiErrorSchema = z.object({
  success: z.literal(false),
  data: z.null(),
  message: z.string(),
  code: z.number(),
  details: z.any().optional(),
}).openapi('ApiError');

export const ok = <T extends z.ZodTypeAny>(data: T, name?: string) => {
  const schema = z.object({
    success: z.literal(true),
    data,
    message: z.string(),
    code: z.number(),
  });
  return name ? schema.openapi(name) : schema;
};

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

/** Helper OpenAPI Security */
export const bearerSecurity = [{ bearerAuth: [] }];
export const basicSecurity = [{ basicAuth: [] }];

export const STANDARD_ERRORS: Record<number, string> = {
  400: 'Permintaan tidak valid',
  401: 'Token tidak valid',
  403: 'Akses ditolak',
  404: 'Tidak ditemukan',
  409: 'Konflik data',
  422: 'Validasi gagal',
};

/** Helper response error: errors([401, 403]), errors({ 404: 'Pesan khusus' }), atau kombinasi errors([401], { 404: 'Pesan' }) */
export const errors = (
  ...args: ((keyof typeof STANDARD_ERRORS | number)[] | Record<number, string> | number)[]
) => {
  const merged: Record<number, string> = {};
  for (const arg of args) {
    if (typeof arg === 'number') {
      merged[arg] = STANDARD_ERRORS[arg] ?? 'Terjadi kesalahan';
    } else if (Array.isArray(arg)) {
      for (const code of arg) {
        merged[code] = STANDARD_ERRORS[code] ?? 'Terjadi kesalahan';
      }
    } else if (typeof arg === 'object' && arg !== null) {
      Object.assign(merged, arg);
    }
  }
  return errorResponses(merged);
};

/** Helper response 200 OK standar */
export const okResponse = <T extends z.ZodTypeAny>(
  schema: T,
  description = 'Berhasil',
  name?: string,
) => ({
  200: {
    description,
    ...json(ok(schema, name)),
  },
});

/** Helper response 201 Created standar */
export const createdResponse = <T extends z.ZodTypeAny>(
  schema: T,
  description = 'Berhasil dibuat',
  name?: string,
) => ({
  201: {
    description,
    ...json(ok(schema, name)),
  },
});

/** Helper response 204 No Content */
export const noContentResponse = (description = 'Berhasil tanpa konten') => ({
  204: {
    description,
  },
});

/** Helper model pagination standar { items, total, page, per_page, total_pages } */
export const paginated = <T extends z.ZodTypeAny>(itemSchema: T, name?: string) => {
  const schema = z.object({
    items: z.array(itemSchema),
    total: z.number(),
    page: z.number(),
    per_page: z.number(),
    total_pages: z.number(),
  });
  return name ? schema.openapi(name) : schema;
};


