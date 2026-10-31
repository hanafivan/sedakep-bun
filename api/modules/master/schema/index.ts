import { z } from 'zod';
import { createRoute } from '@hono/zod-openapi';

/** Master data: organisasi/unit kerja dan jabatan. */

export const ApiErrorSchema = z
  .object({
    success: z.literal(false),
    data: z.null(),
    message: z.string(),
    code: z.number(),
    details: z.any().optional(),
  })
  .openapi('MasterApiError');

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

export const OrganizationSchema = z
  .object({
    id: z.number(),
    code: z.string(),
    name: z.string(),
    parent_id: z.number().nullable(),
    level: z.number(),
    is_active: z.number(),
  })
  .openapi('Organization');

export const PositionSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    grade: z.string().nullable(),
    is_active: z.number(),
  })
  .openapi('Position');

export const OrganizationInputSchema = z
  .object({
    code: z.string().min(1).max(50),
    name: z.string().min(1).max(150),
    parent_id: z.number().int().positive().nullable().optional(),
    level: z.number().int().min(0).max(20).optional(),
    is_active: z.boolean().optional(),
  })
  .openapi('OrganizationInput');

export const PositionInputSchema = z
  .object({
    name: z.string().min(1).max(150),
    grade: z.string().max(20).optional(),
    is_active: z.boolean().optional(),
  })
  .openapi('PositionInput');

const IdParam = z.object({ id: z.coerce.number().int().positive() });

export const listOrganizationsRoute = createRoute({
  method: 'get',
  path: '/organizations',
  tags: ['Master'],
  summary: 'Daftar organisasi/unit kerja',
  security: [{ bearerAuth: [] }],
  request: { query: z.object({ search: z.string().optional(), active_only: z.string().optional() }) },
  responses: {
    200: {
      description: 'Daftar organisasi',
      ...json(ok(z.array(OrganizationSchema), 'OrganizationListResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid' }),
  },
});

export const createOrganizationRoute = createRoute({
  method: 'post',
  path: '/organizations',
  tags: ['Master'],
  summary: 'Tambah organisasi (admin)',
  security: [{ bearerAuth: [] }],
  request: { body: json(OrganizationInputSchema) },
  responses: {
    200: { description: 'Organisasi dibuat', ...json(ok(z.record(z.any()), 'OrganizationCreateResponse')) },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan admin', 422: 'Validasi gagal' }),
  },
});

export const updateOrganizationRoute = createRoute({
  method: 'patch',
  path: '/organizations/{id}',
  tags: ['Master'],
  summary: 'Ubah organisasi (admin)',
  security: [{ bearerAuth: [] }],
  request: { params: IdParam, body: json(OrganizationInputSchema.partial()) },
  responses: {
    200: { description: 'Organisasi diperbarui', ...json(ok(z.record(z.any()), 'OrganizationUpdateResponse')) },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan admin', 404: 'Tidak ditemukan' }),
  },
});

export const deleteOrganizationRoute = createRoute({
  method: 'delete',
  path: '/organizations/{id}',
  tags: ['Master'],
  summary: 'Hapus organisasi (admin)',
  security: [{ bearerAuth: [] }],
  request: { params: IdParam },
  responses: {
    200: { description: 'Organisasi dihapus', ...json(ok(z.null(), 'OrganizationDeleteResponse')) },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan admin', 404: 'Tidak ditemukan' }),
  },
});

export const listPositionsRoute = createRoute({
  method: 'get',
  path: '/positions',
  tags: ['Master'],
  summary: 'Daftar jabatan',
  security: [{ bearerAuth: [] }],
  request: { query: z.object({ search: z.string().optional(), active_only: z.string().optional() }) },
  responses: {
    200: { description: 'Daftar jabatan', ...json(ok(z.array(PositionSchema), 'PositionListResponse')) },
    ...errorResponses({ 401: 'Token tidak valid' }),
  },
});

export const createPositionRoute = createRoute({
  method: 'post',
  path: '/positions',
  tags: ['Master'],
  summary: 'Tambah jabatan (admin)',
  security: [{ bearerAuth: [] }],
  request: { body: json(PositionInputSchema) },
  responses: {
    200: { description: 'Jabatan dibuat', ...json(ok(z.record(z.any()), 'PositionCreateResponse')) },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan admin', 422: 'Validasi gagal' }),
  },
});

export const updatePositionRoute = createRoute({
  method: 'patch',
  path: '/positions/{id}',
  tags: ['Master'],
  summary: 'Ubah jabatan (admin)',
  security: [{ bearerAuth: [] }],
  request: { params: IdParam, body: json(PositionInputSchema.partial()) },
  responses: {
    200: { description: 'Jabatan diperbarui', ...json(ok(z.record(z.any()), 'PositionUpdateResponse')) },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan admin', 404: 'Tidak ditemukan' }),
  },
});

export const deletePositionRoute = createRoute({
  method: 'delete',
  path: '/positions/{id}',
  tags: ['Master'],
  summary: 'Hapus jabatan (admin)',
  security: [{ bearerAuth: [] }],
  request: { params: IdParam },
  responses: {
    200: { description: 'Jabatan dihapus', ...json(ok(z.null(), 'PositionDeleteResponse')) },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan admin', 404: 'Tidak ditemukan' }),
  },
});
