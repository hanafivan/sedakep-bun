import { z } from 'zod';
import { createRoute } from '@hono/zod-openapi';

/** Pengaturan umum: tabel key/value `settings`. */

export const ApiErrorSchema = z
  .object({
    success: z.literal(false),
    data: z.null(),
    message: z.string(),
    code: z.number(),
    details: z.any().optional(),
  })
  .openapi('SettingsApiError');

const ok = <T extends z.ZodTypeAny>(data: T, name: string) =>
  z
    .object({ success: z.literal(true), data, message: z.string(), code: z.number() })
    .openapi(name);

const json = <T extends z.ZodTypeAny>(schema: T) => ({
  content: { 'application/json': { schema } },
});

const errorResponses = (descriptions: Record<number, string>) =>
  Object.fromEntries(
    Object.entries(descriptions).map(([code, description]) => [
      Number(code),
      { description, content: { 'application/json': { schema: ApiErrorSchema } } },
    ]),
  );

export const SettingSchema = z
  .object({
    key: z.string(),
    value: z.string().nullable(),
    description: z.string().nullable(),
    updated_at: z.string(),
    secret: z.boolean(),
    readonly: z.boolean(),
  })
  .openapi('Setting');

export const SettingInputSchema = z
  .object({
    value: z.string().max(65535).nullable(),
    description: z.string().max(255).nullable().optional(),
  })
  .openapi('SettingInput');

const KeyParam = z.object({
  key: z
    .string()
    .min(1)
    .max(75)
    .regex(/^[a-z0-9_.:-]+$/, 'Kunci hanya boleh huruf kecil, angka, titik, garis, titik dua'),
});

export const listSettingsRoute = createRoute({
  method: 'get',
  path: '/settings',
  tags: ['Settings'],
  summary: 'Daftar pengaturan (admin)',
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({ prefix: z.string().optional(), search: z.string().optional() }),
  },
  responses: {
    200: {
      description: 'Daftar pengaturan',
      ...json(ok(z.array(SettingSchema), 'SettingListResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan admin' }),
  },
});

export const getSettingRoute = createRoute({
  method: 'get',
  path: '/settings/{key}',
  tags: ['Settings'],
  summary: 'Detail satu pengaturan (admin)',
  security: [{ bearerAuth: [] }],
  request: { params: KeyParam },
  responses: {
    200: {
      description: 'Detail pengaturan',
      ...json(ok(SettingSchema, 'SettingDetailResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan admin', 404: 'Tidak ditemukan' }),
  },
});

export const upsertSettingRoute = createRoute({
  method: 'put',
  path: '/settings/{key}',
  tags: ['Settings'],
  summary: 'Simpan pengaturan (admin)',
  security: [{ bearerAuth: [] }],
  request: { params: KeyParam, body: json(SettingInputSchema) },
  responses: {
    200: {
      description: 'Pengaturan disimpan',
      ...json(ok(SettingSchema, 'SettingUpsertResponse')),
    },
    ...errorResponses({
      401: 'Token tidak valid',
      403: 'Bukan admin',
      422: 'Validasi gagal',
    }),
  },
});

export const deleteSettingRoute = createRoute({
  method: 'delete',
  path: '/settings/{key}',
  tags: ['Settings'],
  summary: 'Hapus pengaturan (admin)',
  security: [{ bearerAuth: [] }],
  request: { params: KeyParam },
  responses: {
    200: {
      description: 'Pengaturan dihapus',
      ...json(ok(z.null(), 'SettingDeleteResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan admin', 404: 'Tidak ditemukan' }),
  },
});
