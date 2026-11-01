import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { bearerAuth, type AuthUser } from '../../middleware/bearerAuth';
import { requireRole } from '../../middleware/roleGuard';
import { badRequest } from '../../shared/errors';
import { defaultHook } from '../../shared/openapi-hook';
import { errors, json, okResponse } from '../../shared/openapi';
import {
  DELETE_ALIBI_METHOD,
  GET_ALIBI_METHOD,
  PATCH_ALIBI_METHOD,
  POST_ALIBI_METHOD,
} from '../../shared/constant';
import { successBody } from '../../shared/response';
import {
  AlibiAdminDecisionResponseSchema,
  AlibiAdminDecisionSchema,
  AlibiCancelResponseSchema,
  AlibiCancelSchema,
  AlibiCreateResponseSchema,
  AlibiDecisionSchema,
  AlibiDetailResponseSchema,
  AlibiFileResponseSchema,
  AlibiInputSchema,
  AlibiLevelDecisionResponseSchema,
  AlibiListQuerySchema,
  AlibiListResponseSchema,
  AlibiUpdateResponseSchema,
  AlibiUpdateSchema,
  IdParamSchema,
  LevelParamSchema,
  UploadAlibiFileSchema,
} from './schema';
import * as domain from './domain';

/**
 * Route modul alibi — boundary HTTP saja. Middleware di-scope ke prefix modul
 * ini supaya `use('*')` tidak menelan seluruh API.
 */

export const alibiRoutes = new OpenAPIHono({ defaultHook });

for (const prefix of ['/alibi-requests', '/alibi-requests/*']) {
  alibiRoutes.use(prefix, bearerAuth);
}

/** Keputusan admin hanya admin; approval atasan & unggah berkas untuk atasan/admin. */
alibiRoutes.use('/alibi-requests/*/approve/admin', requireRole('admin'));
for (const prefix of ['/alibi-requests/*/approve/level/*', '/alibi-requests/*/file']) {
  alibiRoutes.use(prefix, requireRole('atasan'));
}

const actor = (c: Context): AuthUser => c.get('user');
const seesAll = (user: AuthUser) =>
  user.role === 'admin' || user.role === 'verifikator' || user.role === 'atasan';

const listAlibiRequestsRoute = createRoute({
  ...GET_ALIBI_METHOD,
  path: '/alibi-requests',
  summary: 'Daftar alibi (cari nama/NIP/jenis)',
  request: {
    query: AlibiListQuerySchema,
  },
  responses: {
    ...okResponse(AlibiListResponseSchema, 'Daftar alibi', 'AlibiListResponse'),
    ...errors([401]),
  },
});

const createAlibiRequestRoute = createRoute({
  ...POST_ALIBI_METHOD,
  path: '/alibi-requests',
  summary: 'Ajukan alibi',
  request: { body: json(AlibiInputSchema) },
  responses: {
    ...okResponse(AlibiCreateResponseSchema, 'Alibi dibuat', 'AlibiCreateResponse'),
    ...errors([401, 422]),
  },
});

const getAlibiRequestRoute = createRoute({
  ...GET_ALIBI_METHOD,
  path: '/alibi-requests/{id}',
  summary: 'Detail alibi + berkas',
  request: { params: IdParamSchema },
  responses: {
    ...okResponse(AlibiDetailResponseSchema, 'Detail alibi', 'AlibiDetailResponse'),
    ...errors([401, 404], { 403: 'Bukan pemilik' }),
  },
});

const updateAlibiRequestRoute = createRoute({
  ...PATCH_ALIBI_METHOD,
  path: '/alibi-requests/{id}',
  summary: 'Ubah alibi (belum final)',
  request: { params: IdParamSchema, body: json(AlibiUpdateSchema) },
  responses: {
    ...okResponse(AlibiUpdateResponseSchema, 'Alibi diperbarui', 'AlibiUpdateResponse'),
    ...errors([401, 404], { 403: 'Bukan pemilik' }),
  },
});

const deleteAlibiRequestRoute = createRoute({
  ...DELETE_ALIBI_METHOD,
  path: '/alibi-requests/{id}',
  summary: 'Hapus alibi (belum disetujui)',
  request: { params: IdParamSchema },
  responses: {
    ...okResponse(z.null(), 'Alibi dihapus', 'AlibiDeleteResponse'),
    ...errors([401, 404], { 403: 'Bukan pemilik' }),
  },
});

const approveAlibiAdminRoute = createRoute({
  ...POST_ALIBI_METHOD,
  path: '/alibi-requests/{id}/approve/admin',
  summary: 'Keputusan admin (terima/tolak/batal)',
  request: { params: IdParamSchema, body: json(AlibiAdminDecisionSchema) },
  responses: {
    ...okResponse(AlibiAdminDecisionResponseSchema, 'Keputusan admin tersimpan', 'AlibiAdminDecisionResponse'),
    ...errors([401, 404], { 403: 'Bukan admin' }),
  },
});

const approveAlibiLevelRoute = createRoute({
  ...POST_ALIBI_METHOD,
  path: '/alibi-requests/{id}/approve/level/{level}',
  summary: 'Keputusan atasan level 1/2',
  request: { params: LevelParamSchema, body: json(AlibiDecisionSchema) },
  responses: {
    ...okResponse(AlibiLevelDecisionResponseSchema, 'Keputusan atasan tersimpan', 'AlibiLevelDecisionResponse'),
    ...errors([401, 404], { 403: 'Bukan atasan' }),
  },
});

const cancelAlibiRoute = createRoute({
  ...POST_ALIBI_METHOD,
  path: '/alibi-requests/{id}/cancel',
  summary: 'Batalkan alibi (pemilik/admin)',
  request: { params: IdParamSchema, body: json(AlibiCancelSchema) },
  responses: {
    ...okResponse(AlibiCancelResponseSchema, 'Alibi dibatalkan', 'AlibiCancelResponse'),
    ...errors([401, 404], { 403: 'Bukan pemilik' }),
  },
});

const uploadAlibiFileRoute = createRoute({
  ...POST_ALIBI_METHOD,
  path: '/alibi-requests/{id}/file',
  summary: 'Unggah berkas alibi (admin/atasan)',
  request: {
    params: IdParamSchema,
    body: { content: { 'multipart/form-data': { schema: UploadAlibiFileSchema } } },
  },
  responses: {
    ...okResponse(AlibiFileResponseSchema, 'Berkas tersimpan', 'AlibiFileResponse'),
    ...errors([401, 404], { 403: 'Bukan admin/atasan' }),
  },
});

alibiRoutes.openapi(listAlibiRequestsRoute, async (c) => {
  const query = c.req.valid('query');
  const user = actor(c);
  const scopedUserId = query.user_id ?? (seesAll(user) ? undefined : Number(user.id));
  const result = await domain.listAlibiRequests({
    userId: scopedUserId,
    status: query.status,
    year: query.year,
    search: query.search,
    page: query.page,
    perPage: query.per_page,
  });
  return c.json(successBody(result, 'Daftar alibi'), 200);
});

alibiRoutes.openapi(createAlibiRequestRoute, async (c) => {
  const body = c.req.valid('json');
  const user = actor(c);
  const requestedUserId = body.user_id ?? Number(user.id);
  const userId = user.role === 'admin' ? requestedUserId : Number(user.id);
  const result = await domain.createAlibiRequest({ ...body, user_id: userId }, user);
  return c.json(successBody(result, 'Alibi dibuat'), 200);
});

alibiRoutes.openapi(getAlibiRequestRoute, async (c) => {
  const { id } = c.req.valid('param');
  const detail = await domain.getAlibiRequestDetail(id);
  if (!domain.canViewAlibi(actor(c), detail)) {
    throw badRequest('Tidak berhak melihat alibi milik pegawai lain');
  }
  return c.json(successBody(detail, 'Detail alibi'), 200);
});

alibiRoutes.openapi(updateAlibiRequestRoute, async (c) => {
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const result = await domain.updateAlibiRequestById(id, body, actor(c));
  return c.json(successBody(result, 'Alibi diperbarui'), 200);
});

alibiRoutes.openapi(deleteAlibiRequestRoute, async (c) => {
  const { id } = c.req.valid('param');
  await domain.removeAlibiRequest(id, actor(c));
  return c.json(successBody(null, 'Alibi dihapus'), 200);
});

alibiRoutes.openapi(approveAlibiAdminRoute, async (c) => {
  const id = Number(c.req.param('id'));
  const body = c.req.valid('json');
  const result = await domain.decideAlibiAdmin(id, body, actor(c));
  return c.json(successBody(result, 'Keputusan admin tersimpan'), 200);
});

alibiRoutes.openapi(approveAlibiLevelRoute, async (c) => {
  const id = Number(c.req.param('id'));
  const level = Number(c.req.param('level'));
  const body = c.req.valid('json');
  const result = await domain.decideAlibiApprover(id, level as 1 | 2, body, actor(c));
  return c.json(successBody(result, 'Keputusan atasan tersimpan'), 200);
});

alibiRoutes.openapi(cancelAlibiRoute, async (c) => {
  const id = Number(c.req.param('id'));
  const body = c.req.valid('json');
  const result = await domain.cancelAlibi(id, actor(c), body.note);
  return c.json(successBody(result, 'Alibi dibatalkan'), 200);
});

alibiRoutes.openapi(uploadAlibiFileRoute, async (c) => {
  const id = Number(c.req.param('id'));
  const form = await c.req.parseBody();
  const file = form.file;
  if (!(file instanceof File)) throw badRequest('Berkas wajib dilampirkan');
  const result = await domain.attachAlibiFile(
    id,
    {
      buffer: Buffer.from(await file.arrayBuffer()),
      filename: file.name || 'berkas',
      mimeType: file.type || null,
    },
    actor(c),
  );
  return c.json(successBody(result, 'Berkas alibi tersimpan'), 200);
});
