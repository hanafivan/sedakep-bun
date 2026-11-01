import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { bearerAuth, type AuthUser } from '../../middleware/bearerAuth';
import { requireRole } from '../../middleware/roleGuard';
import { defaultHook } from '../../shared/openapi-hook';
import { errors, json, okResponse } from '../../shared/openapi';
import {
  DELETE_SETTING_METHOD,
  GET_SETTING_METHOD,
  PUT_SETTING_METHOD,
} from '../../shared/constant';
import { successBody } from '../../shared/response';
import {
  KeyParamSchema,
  SettingInputSchema,
  SettingListResponseSchema,
  SettingSchema,
  SettingsQuerySchema,
} from './schema';
import * as domain from './domain';

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

const listSettingsRoute = createRoute({
  ...GET_SETTING_METHOD,
  path: '/settings',
  summary: 'Daftar pengaturan (admin)',
  request: {
    query: SettingsQuerySchema,
  },
  responses: {
    ...okResponse(SettingListResponseSchema, 'Daftar pengaturan', 'SettingListResponse'),
    ...errors([401], { 403: 'Bukan admin' }),
  },
});

const getSettingRoute = createRoute({
  ...GET_SETTING_METHOD,
  path: '/settings/{key}',
  summary: 'Detail satu pengaturan (admin)',
  request: { params: KeyParamSchema },
  responses: {
    ...okResponse(SettingSchema, 'Detail pengaturan', 'SettingDetailResponse'),
    ...errors([401, 404], { 403: 'Bukan admin' }),
  },
});

const upsertSettingRoute = createRoute({
  ...PUT_SETTING_METHOD,
  path: '/settings/{key}',
  summary: 'Simpan pengaturan (admin)',
  request: { params: KeyParamSchema, body: json(SettingInputSchema) },
  responses: {
    ...okResponse(SettingSchema, 'Pengaturan disimpan', 'SettingUpsertResponse'),
    ...errors([401, 422], { 403: 'Bukan admin' }),
  },
});

const deleteSettingRoute = createRoute({
  ...DELETE_SETTING_METHOD,
  path: '/settings/{key}',
  summary: 'Hapus pengaturan (admin)',
  request: { params: KeyParamSchema },
  responses: {
    ...okResponse(z.null(), 'Pengaturan dihapus', 'SettingDeleteResponse'),
    ...errors([401, 404], { 403: 'Bukan admin' }),
  },
});

settingsRoutes.openapi(listSettingsRoute, async (c) => {
  const query = c.req.valid('query');
  const items = await domain.listSettings({ prefix: query.prefix, search: query.search });
  return c.json(successBody(items, 'Daftar pengaturan'), 200);
});

settingsRoutes.openapi(getSettingRoute, async (c) => {
  const { key } = c.req.valid('param');
  const item = await domain.getSetting(key);
  return c.json(successBody(item, 'Detail pengaturan'), 200);
});

settingsRoutes.openapi(upsertSettingRoute, async (c) => {
  const { key } = c.req.valid('param');
  const body = c.req.valid('json');
  const item = await domain.setSetting(
    key,
    { value: body.value, description: body.description },
    Number(actor(c).id),
  );
  return c.json(successBody(item, 'Pengaturan disimpan'), 200);
});

settingsRoutes.openapi(deleteSettingRoute, async (c) => {
  const { key } = c.req.valid('param');
  await domain.removeSetting(key, Number(actor(c).id));
  return c.json(successBody(null, 'Pengaturan dihapus'), 200);
});
