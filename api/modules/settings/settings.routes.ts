import { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { bearerAuth, type AuthUser } from '../../middleware/bearerAuth';
import { requireRole } from '../../middleware/roleGuard';
import { defaultHook } from '../../shared/openapi-hook';
import { successBody } from '../../shared/response';
import {
  deleteSettingRoute,
  getSettingRoute,
  listSettingsRoute,
  upsertSettingRoute,
} from './schema';
import * as service from './service';

/**
 * Route modul pengaturan — boundary HTTP saja, admin saja.
 *
 * Middleware di-scope ke prefix modul: `use('*')` pada instance yang di-mount
 * di `/api/v1` akan menelan seluruh API.
 */

export const settingsRoutes = new OpenAPIHono({ defaultHook });

for (const prefix of ['/settings', '/settings/*']) {
  settingsRoutes.use(prefix, bearerAuth);
  settingsRoutes.use(prefix, requireRole('admin'));
}

const actor = (c: Context): AuthUser => c.get('user');

settingsRoutes.openapi(listSettingsRoute, async (c) => {
  const query = c.req.valid('query');
  const items = await service.listSettings({ prefix: query.prefix, search: query.search });
  return c.json(successBody(items, 'Daftar pengaturan'), 200);
});

settingsRoutes.openapi(getSettingRoute, async (c) => {
  const { key } = c.req.valid('param');
  const item = await service.getSetting(key);
  return c.json(successBody(item, 'Detail pengaturan'), 200);
});

settingsRoutes.openapi(upsertSettingRoute, async (c) => {
  const { key } = c.req.valid('param');
  const body = c.req.valid('json');
  const item = await service.setSetting(
    key,
    { value: body.value, description: body.description },
    Number(actor(c).id),
  );
  return c.json(successBody(item, 'Pengaturan disimpan'), 200);
});

settingsRoutes.openapi(deleteSettingRoute, async (c) => {
  const { key } = c.req.valid('param');
  await service.removeSetting(key, Number(actor(c).id));
  return c.json(successBody(null, 'Pengaturan dihapus'), 200);
});
