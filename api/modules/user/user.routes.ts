import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { config } from '../../config';
import { bearerAuth } from '../../middleware/bearerAuth';
import { requireRole } from '../../middleware/roleGuard';
import { defaultHook } from '../../shared/openapi-hook';
import { errors, json, okResponse } from '../../shared/openapi';
import {
  GET_USER_ADMIN_METHOD,
  GET_USER_METHOD,
  PATCH_USER_ADMIN_METHOD,
  PATCH_USER_METHOD,
  POST_USER_ADMIN_METHOD,
  POST_USER_METHOD,
  POST_USER_PUBLIC_METHOD,
} from '../../shared/constant';
import { successBody } from '../../shared/response';
import {
  ChangePasswordSchema,
  ListUsersQuerySchema,
  LoginResponseSchema,
  LoginSchema,
  RegisterSchema,
  ResetPasswordBodySchema,
  UpdateUserSchema,
  UserIdParamSchema,
  UserListResponseSchema,
  UserSchema,
} from './schema';
import { UserService } from './domain';

/** Route modul user — boundary HTTP saja. Aturan bisnis ada di domain. */

export const userRoutes = new OpenAPIHono({ defaultHook });

const service = () => new UserService(config.jwt.secret, config.jwt.expiresInSeconds);

const registerRoute = createRoute({
  ...POST_USER_PUBLIC_METHOD,
  path: '/register',
  summary: 'Register user baru',
  request: { body: json(RegisterSchema) },
  responses: {
    ...okResponse(z.null(), 'User terdaftar', 'RegisterResponse'),
    ...errors([422], { 409: 'Username sudah dipakai' }),
  },
});

const loginRoute = createRoute({
  ...POST_USER_PUBLIC_METHOD,
  path: '/login',
  summary: 'Login dan dapatkan JWT',
  request: { body: json(LoginSchema) },
  responses: {
    ...okResponse(LoginResponseSchema, 'Login berhasil', 'LoginResponse'),
    ...errors([422], { 401: 'Username atau password salah' }),
  },
});

const meRoute = createRoute({
  ...GET_USER_METHOD,
  path: '/me',
  summary: 'Data user dari token JWT',
  responses: {
    ...okResponse(UserSchema, 'Data user', 'MeResponse'),
    ...errors([401], { 404: 'User tidak ditemukan' }),
  },
});

const changePasswordRoute = createRoute({
  ...POST_USER_METHOD,
  path: '/me/password',
  summary: 'Ganti password sendiri (hash legacy otomatis di-upgrade)',
  request: { body: json(ChangePasswordSchema) },
  responses: {
    ...okResponse(z.null(), 'Password diganti', 'ChangePasswordResponse'),
    ...errors([401], { 400: 'Password lama salah' }),
  },
});

const updateMeRoute = createRoute({
  ...PATCH_USER_METHOD,
  path: '/me',
  summary: 'Ubah profil sendiri',
  request: { body: json(UpdateUserSchema) },
  responses: {
    ...okResponse(UserSchema, 'Profil diperbarui', 'UpdateMeResponse'),
    ...errors([401, 422]),
  },
});

const listUsersRoute = createRoute({
  ...GET_USER_ADMIN_METHOD,
  path: '/',
  summary: 'Daftar user (butuh role admin)',
  request: { query: ListUsersQuerySchema },
  responses: {
    ...okResponse(
      UserListResponseSchema,
      'Daftar user',
      'UserListResponse',
    ),
    ...errors([401], { 403: 'Bukan admin' }),
  },
});

const getUserRoute = createRoute({
  ...GET_USER_ADMIN_METHOD,
  path: '/{id}',
  summary: 'Detail user',
  request: { params: UserIdParamSchema },
  responses: {
    ...okResponse(UserSchema, 'Detail user', 'UserDetailResponse'),
    ...errors([404]),
  },
});

const updateUserRoute = createRoute({
  ...PATCH_USER_ADMIN_METHOD,
  path: '/{id}',
  summary: 'Ubah user (butuh role admin)',
  request: { params: UserIdParamSchema, body: json(UpdateUserSchema) },
  responses: {
    ...okResponse(UserSchema, 'User diperbarui', 'UpdateUserResponse'),
    ...errors([404, 422]),
  },
});

const resetPasswordRoute = createRoute({
  ...POST_USER_ADMIN_METHOD,
  path: '/{id}/reset-password',
  summary: 'Reset password user oleh admin',
  request: {
    params: UserIdParamSchema,
    body: json(ResetPasswordBodySchema),
  },
  responses: {
    ...okResponse(z.null(), 'Password direset', 'ResetPasswordResponse'),
    ...errors([404]),
  },
});

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
