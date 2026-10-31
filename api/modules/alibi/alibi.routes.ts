import { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { bearerAuth, type AuthUser } from '../../middleware/bearerAuth';
import { requireRole } from '../../middleware/roleGuard';
import { badRequest } from '../../shared/errors';
import { defaultHook } from '../../shared/openapi-hook';
import { successBody } from '../../shared/response';
import {
  approveAlibiAdminRoute,
  approveAlibiLevelRoute,
  cancelAlibiRoute,
  createAlibiRequestRoute,
  deleteAlibiRequestRoute,
  getAlibiRequestRoute,
  listAlibiRequestsRoute,
  updateAlibiRequestRoute,
  uploadAlibiFileRoute,
} from './schema';
import * as service from './service';

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

alibiRoutes.openapi(listAlibiRequestsRoute, async (c) => {
  const query = c.req.valid('query');
  const user = actor(c);
  const scopedUserId = query.user_id ?? (seesAll(user) ? undefined : Number(user.id));
  const result = await service.listAlibiRequests({
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
  const result = await service.createAlibiRequest({ ...body, user_id: userId }, user);
  return c.json(successBody(result, 'Alibi dibuat'), 200);
});

alibiRoutes.openapi(getAlibiRequestRoute, async (c) => {
  const { id } = c.req.valid('param');
  const detail = await service.getAlibiRequestDetail(id);
  if (!service.canViewAlibi(actor(c), detail)) {
    throw badRequest('Tidak berhak melihat alibi milik pegawai lain');
  }
  return c.json(successBody(detail, 'Detail alibi'), 200);
});

alibiRoutes.openapi(updateAlibiRequestRoute, async (c) => {
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const result = await service.updateAlibiRequestById(id, body, actor(c));
  return c.json(successBody(result, 'Alibi diperbarui'), 200);
});

alibiRoutes.openapi(deleteAlibiRequestRoute, async (c) => {
  const { id } = c.req.valid('param');
  await service.removeAlibiRequest(id, actor(c));
  return c.json(successBody(null, 'Alibi dihapus'), 200);
});

alibiRoutes.openapi(approveAlibiAdminRoute, async (c) => {
  const id = Number(c.req.param('id'));
  const body = c.req.valid('json');
  const result = await service.decideAlibiAdmin(id, body, actor(c));
  return c.json(successBody(result, 'Keputusan admin tersimpan'), 200);
});

alibiRoutes.openapi(approveAlibiLevelRoute, async (c) => {
  const id = Number(c.req.param('id'));
  const level = Number(c.req.param('level'));
  const body = c.req.valid('json');
  const result = await service.decideAlibiApprover(id, level as 1 | 2, body, actor(c));
  return c.json(successBody(result, 'Keputusan atasan tersimpan'), 200);
});

alibiRoutes.openapi(cancelAlibiRoute, async (c) => {
  const id = Number(c.req.param('id'));
  const body = c.req.valid('json');
  const result = await service.cancelAlibi(id, actor(c), body.note);
  return c.json(successBody(result, 'Alibi dibatalkan'), 200);
});

alibiRoutes.openapi(uploadAlibiFileRoute, async (c) => {
  const id = Number(c.req.param('id'));
  const form = await c.req.parseBody();
  const file = form.file;
  if (!(file instanceof File)) throw badRequest('Berkas wajib dilampirkan');
  const result = await service.attachAlibiFile(
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
