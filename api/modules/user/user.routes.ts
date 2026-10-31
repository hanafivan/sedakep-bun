import { OpenAPIHono } from '@hono/zod-openapi';
import { config } from '../../config';
import { bearerAuth } from '../../middleware/bearerAuth';
import { requireRole } from '../../middleware/roleGuard';
import { defaultHook } from '../../shared/openapi-hook';
import { successBody } from '../../shared/response';
import {
  changePasswordRoute,
  getUserRoute,
  listUsersRoute,
  loginRoute,
  meRoute,
  registerRoute,
  resetPasswordRoute,
  updateMeRoute,
  updateUserRoute,
} from './schema';
import { UserService } from './service';

/** Route modul user — boundary HTTP saja. Aturan bisnis ada di service. */

export const userRoutes = new OpenAPIHono({ defaultHook });

const service = () => new UserService(config.jwt.secret, config.jwt.expiresInSeconds);

userRoutes.openapi(registerRoute, async (c) => {
  await service().register(c.req.valid('json'));
  return c.json(successBody(null, 'User berhasil didaftarkan', 200), 200);
});

userRoutes.openapi(loginRoute, async (c) => {
  const result = await service().login(c.req.valid('json'));
  return c.json(successBody(result, 'Login berhasil', 200), 200);
});

userRoutes.use('/me', bearerAuth);
userRoutes.use('/me/*', bearerAuth);

userRoutes.openapi(meRoute, async (c) => {
  const { id } = c.get('user');
  const user = await service().getById(Number(id));
  return c.json(successBody(user, 'Data user berhasil diambil', 200), 200);
});

userRoutes.openapi(updateMeRoute, async (c) => {
  const { id } = c.get('user');
  const user = await service().update(Number(id), c.req.valid('json'));
  return c.json(successBody(user, 'Profil diperbarui', 200), 200);
});

userRoutes.openapi(changePasswordRoute, async (c) => {
  const { id } = c.get('user');
  const body = c.req.valid('json');
  await service().changeOwnPassword(Number(id), body.current_password, body.new_password);
  return c.json(successBody(null, 'Password berhasil diganti', 200), 200);
});

// ---------- manajemen user: admin saja ----------
userRoutes.use('/', bearerAuth, requireRole('admin'));
userRoutes.use('/:id', bearerAuth, requireRole('admin'));
userRoutes.use('/:id/*', bearerAuth, requireRole('admin'));

userRoutes.openapi(listUsersRoute, async (c) => {
  const query = c.req.valid('query');
  const result = await service().list({
    search: query.search,
    role: query.role,
    organizationId: query.organization_id,
    isActive: query.is_active === undefined ? undefined : query.is_active === 'true',
    page: query.page,
    perPage: query.per_page,
  });
  return c.json(successBody(result, 'Daftar user'), 200);
});

userRoutes.openapi(getUserRoute, async (c) => {
  const { id } = c.req.valid('param');
  const user = await service().getById(id);
  return c.json(successBody(user, 'Detail user'), 200);
});

userRoutes.openapi(updateUserRoute, async (c) => {
  const { id } = c.req.valid('param');
  const user = await service().update(id, c.req.valid('json'));
  return c.json(successBody(user, 'User diperbarui'), 200);
});

userRoutes.openapi(resetPasswordRoute, async (c) => {
  const { id } = c.req.valid('param');
  await service().resetPassword(id, c.req.valid('json').new_password);
  return c.json(successBody(null, 'Password user direset'), 200);
});
