import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { createMiddleware } from 'hono/factory';
import { bearerAuth } from '../../middleware/bearerAuth';
import { forbidden } from '../../shared/errors';
import { defaultHook } from '../../shared/openapi-hook';
import { errors, json, okResponse } from '../../shared/openapi';
import {
  DELETE_MASTER_METHOD,
  GET_MASTER_METHOD,
  PATCH_MASTER_METHOD,
  POST_MASTER_METHOD,
} from '../../shared/constant';
import { successBody } from '../../shared/response';
import {
  IdParamSchema,
  MasterQuerySchema,
  OrganizationCreateResponseSchema,
  OrganizationInputSchema,
  OrganizationListResponseSchema,
  OrganizationUpdateResponseSchema,
  PositionCreateResponseSchema,
  PositionInputSchema,
  PositionListResponseSchema,
  PositionUpdateResponseSchema,
} from './schema';
import * as domain from './domain';

/**
 * Route master data. Baca untuk semua user terautentikasi (dipakai form),
 * tulis hanya admin.
 */

export const masterRoutes = new OpenAPIHono({ defaultHook });

for (const prefix of ['/organizations', '/organizations/*', '/positions', '/positions/*']) {
  masterRoutes.use(prefix, bearerAuth);
}

/** GET bebas untuk user login; selain GET wajib admin. */
const writeGuard = createMiddleware(async (c, next) => {
  if (c.req.method === 'GET') return next();
  const user = c.get('user');
  if (!user || user.role !== 'admin') throw forbidden('Bukan admin');
  await next();
});
for (const prefix of ['/organizations', '/organizations/*', '/positions', '/positions/*']) {
  masterRoutes.use(prefix, writeGuard);
}

const listOrganizationsRoute = createRoute({
  ...GET_MASTER_METHOD,
  path: '/organizations',
  summary: 'Daftar organisasi/unit kerja',
  request: { query: MasterQuerySchema },
  responses: {
    ...okResponse(OrganizationListResponseSchema, 'Daftar organisasi', 'OrganizationListResponse'),
    ...errors([401]),
  },
});

const createOrganizationRoute = createRoute({
  ...POST_MASTER_METHOD,
  path: '/organizations',
  summary: 'Tambah organisasi (admin)',
  request: { body: json(OrganizationInputSchema) },
  responses: {
    ...okResponse(OrganizationCreateResponseSchema, 'Organisasi dibuat', 'OrganizationCreateResponse'),
    ...errors([401, 422], { 403: 'Bukan admin' }),
  },
});

const updateOrganizationRoute = createRoute({
  ...PATCH_MASTER_METHOD,
  path: '/organizations/{id}',
  summary: 'Ubah organisasi (admin)',
  request: { params: IdParamSchema, body: json(OrganizationInputSchema.partial()) },
  responses: {
    ...okResponse(OrganizationUpdateResponseSchema, 'Organisasi diperbarui', 'OrganizationUpdateResponse'),
    ...errors([401, 404], { 403: 'Bukan admin' }),
  },
});

const deleteOrganizationRoute = createRoute({
  ...DELETE_MASTER_METHOD,
  path: '/organizations/{id}',
  summary: 'Hapus organisasi (admin)',
  request: { params: IdParamSchema },
  responses: {
    ...okResponse(z.null(), 'Organisasi dihapus', 'OrganizationDeleteResponse'),
    ...errors([401, 404], { 403: 'Bukan admin' }),
  },
});

const listPositionsRoute = createRoute({
  ...GET_MASTER_METHOD,
  path: '/positions',
  summary: 'Daftar jabatan',
  request: { query: MasterQuerySchema },
  responses: {
    ...okResponse(PositionListResponseSchema, 'Daftar jabatan', 'PositionListResponse'),
    ...errors([401]),
  },
});

const createPositionRoute = createRoute({
  ...POST_MASTER_METHOD,
  path: '/positions',
  summary: 'Tambah jabatan (admin)',
  request: { body: json(PositionInputSchema) },
  responses: {
    ...okResponse(PositionCreateResponseSchema, 'Jabatan dibuat', 'PositionCreateResponse'),
    ...errors([401, 422], { 403: 'Bukan admin' }),
  },
});

const updatePositionRoute = createRoute({
  ...PATCH_MASTER_METHOD,
  path: '/positions/{id}',
  summary: 'Ubah jabatan (admin)',
  request: { params: IdParamSchema, body: json(PositionInputSchema.partial()) },
  responses: {
    ...okResponse(PositionUpdateResponseSchema, 'Jabatan diperbarui', 'PositionUpdateResponse'),
    ...errors([401, 404], { 403: 'Bukan admin' }),
  },
});

const deletePositionRoute = createRoute({
  ...DELETE_MASTER_METHOD,
  path: '/positions/{id}',
  summary: 'Hapus jabatan (admin)',
  request: { params: IdParamSchema },
  responses: {
    ...okResponse(z.null(), 'Jabatan dihapus', 'PositionDeleteResponse'),
    ...errors([401, 404], { 403: 'Bukan admin' }),
  },
});

const activeOnly = (value?: string) => value === 'true' || value === '1';

masterRoutes.openapi(listOrganizationsRoute, async (c) => {
  const query = c.req.valid('query');
  const items = await domain.listOrganizations({
    search: query.search,
    activeOnly: activeOnly(query.active_only),
  });
  return c.json(successBody(items, 'Daftar organisasi'), 200);
});

masterRoutes.openapi(createOrganizationRoute, async (c) => {
  const body = c.req.valid('json');
  const result = await domain.createOrganization(body);
  return c.json(successBody(result, 'Organisasi dibuat'), 200);
});

masterRoutes.openapi(updateOrganizationRoute, async (c) => {
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const result = await domain.updateOrganizationById(id, body);
  return c.json(successBody(result, 'Organisasi diperbarui'), 200);
});

masterRoutes.openapi(deleteOrganizationRoute, async (c) => {
  const { id } = c.req.valid('param');
  await domain.removeOrganization(id);
  return c.json(successBody(null, 'Organisasi dihapus'), 200);
});

masterRoutes.openapi(listPositionsRoute, async (c) => {
  const query = c.req.valid('query');
  const items = await domain.listPositions({
    search: query.search,
    activeOnly: activeOnly(query.active_only),
  });
  return c.json(successBody(items, 'Daftar jabatan'), 200);
});

masterRoutes.openapi(createPositionRoute, async (c) => {
  const body = c.req.valid('json');
  const result = await domain.createPosition(body);
  return c.json(successBody(result, 'Jabatan dibuat'), 200);
});

masterRoutes.openapi(updatePositionRoute, async (c) => {
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const result = await domain.updatePositionById(id, body);
  return c.json(successBody(result, 'Jabatan diperbarui'), 200);
});

masterRoutes.openapi(deletePositionRoute, async (c) => {
  const { id } = c.req.valid('param');
  await domain.removePosition(id);
  return c.json(successBody(null, 'Jabatan dihapus'), 200);
});
