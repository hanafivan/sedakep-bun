import { OpenAPIHono } from '@hono/zod-openapi';
import { createMiddleware } from 'hono/factory';
import { bearerAuth } from '../../middleware/bearerAuth';
import { forbidden } from '../../shared/errors';
import { defaultHook } from '../../shared/openapi-hook';
import { successBody } from '../../shared/response';
import {
  createOrganizationRoute,
  createPositionRoute,
  deleteOrganizationRoute,
  deletePositionRoute,
  listOrganizationsRoute,
  listPositionsRoute,
  updateOrganizationRoute,
  updatePositionRoute,
} from './schema';
import * as service from './service';

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

const activeOnly = (value?: string) => value === 'true' || value === '1';

masterRoutes.openapi(listOrganizationsRoute, async (c) => {
  const query = c.req.valid('query');
  const items = await service.listOrganizations({
    search: query.search,
    activeOnly: activeOnly(query.active_only),
  });
  return c.json(successBody(items, 'Daftar organisasi'), 200);
});

masterRoutes.openapi(createOrganizationRoute, async (c) => {
  const body = c.req.valid('json');
  const result = await service.createOrganization(body);
  return c.json(successBody(result, 'Organisasi dibuat'), 200);
});

masterRoutes.openapi(updateOrganizationRoute, async (c) => {
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const result = await service.updateOrganizationById(id, body);
  return c.json(successBody(result, 'Organisasi diperbarui'), 200);
});

masterRoutes.openapi(deleteOrganizationRoute, async (c) => {
  const { id } = c.req.valid('param');
  await service.removeOrganization(id);
  return c.json(successBody(null, 'Organisasi dihapus'), 200);
});

masterRoutes.openapi(listPositionsRoute, async (c) => {
  const query = c.req.valid('query');
  const items = await service.listPositions({
    search: query.search,
    activeOnly: activeOnly(query.active_only),
  });
  return c.json(successBody(items, 'Daftar jabatan'), 200);
});

masterRoutes.openapi(createPositionRoute, async (c) => {
  const body = c.req.valid('json');
  const result = await service.createPosition(body);
  return c.json(successBody(result, 'Jabatan dibuat'), 200);
});

masterRoutes.openapi(updatePositionRoute, async (c) => {
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const result = await service.updatePositionById(id, body);
  return c.json(successBody(result, 'Jabatan diperbarui'), 200);
});

masterRoutes.openapi(deletePositionRoute, async (c) => {
  const { id } = c.req.valid('param');
  await service.removePosition(id);
  return c.json(successBody(null, 'Jabatan dihapus'), 200);
});
