import { z } from 'zod';
import { createRoute } from '@hono/zod-openapi';

/**
 * Schema request/response + definisi route modul user.
 * Zod sekaligus jadi spesifikasi OpenAPI.
 */

export const RoleEnum = z.enum(['pegawai', 'verifikator', 'atasan', 'admin']);

export const RegisterSchema = z.object({
  username: z.string().min(3, 'Username minimal 3 karakter').max(75),
  password: z.string().min(6, 'Password minimal 6 karakter'),
  name: z.string().min(1, 'Nama wajib diisi').max(120).optional(),
  nip: z.string().max(18).optional(),
  role: RoleEnum.optional(),
}).openapi('RegisterRequest');

export const LoginSchema = z.object({
  username: z.string().min(1, 'Username wajib diisi'),
  password: z.string().min(1, 'Password wajib diisi'),
}).openapi('LoginRequest');

export const ChangePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(6, 'Password minimal 6 karakter'),
}).openapi('ChangePassword');

export const UpdateUserSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  nip: z.string().max(18).optional(),
  grade: z.string().max(20).optional(),
  email: z.string().email().max(150).optional(),
  phone: z.string().max(30).optional(),
  role: RoleEnum.optional(),
  organization_id: z.number().int().positive().nullable().optional(),
  position_id: z.number().int().positive().nullable().optional(),
  is_active: z.boolean().optional(),
}).openapi('UpdateUser');

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;

export const UserSchema = z.object({
  id: z.number(),
  username: z.string(),
  name: z.string(),
  nip: z.string().nullable(),
  grade: z.string().nullable(),
  role: z.string(),
  organization_id: z.number().nullable(),
  employment_type: z.string(),
  is_active: z.boolean(),
  created_at: z.string(),
}).openapi('User');

export type UserResponse = z.infer<typeof UserSchema>;

export const ApiErrorSchema = z.object({
  success: z.literal(false),
  data: z.null(),
  message: z.string(),
  code: z.number(),
  details: z.any().optional(),
}).openapi('ApiError');

const ok = <T extends z.ZodTypeAny>(data: T, name: string) =>
  z.object({
    success: z.literal(true),
    data,
    message: z.string(),
    code: z.number(),
  }).openapi(name);

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

export const registerRoute = createRoute({
  method: 'post',
  path: '/register',
  tags: ['User'],
  summary: 'Register user baru',
  request: { body: { content: { 'application/json': { schema: RegisterSchema } } } },
  responses: {
    200: { description: 'User terdaftar', ...json(ok(z.null(), 'RegisterResponse')) },
    ...errorResponses({ 409: 'Username sudah dipakai', 422: 'Validasi gagal' }),
  },
});

export const loginRoute = createRoute({
  method: 'post',
  path: '/login',
  tags: ['User'],
  summary: 'Login dan dapatkan JWT',
  request: { body: { content: { 'application/json': { schema: LoginSchema } } } },
  responses: {
    200: {
      description: 'Login berhasil',
      ...json(ok(z.object({ token: z.string(), user: UserSchema }), 'LoginResponse')),
    },
    ...errorResponses({ 401: 'Username atau password salah', 422: 'Validasi gagal' }),
  },
});

export const meRoute = createRoute({
  method: 'get',
  path: '/me',
  tags: ['User'],
  summary: 'Data user dari token JWT',
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: 'Data user', ...json(ok(UserSchema, 'MeResponse')) },
    ...errorResponses({ 401: 'Token tidak valid', 404: 'User tidak ditemukan' }),
  },
});

export const changePasswordRoute = createRoute({
  method: 'post',
  path: '/me/password',
  tags: ['User'],
  summary: 'Ganti password sendiri (hash legacy otomatis di-upgrade)',
  security: [{ bearerAuth: [] }],
  request: { body: json(ChangePasswordSchema) },
  responses: {
    200: { description: 'Password diganti', ...json(ok(z.null(), 'ChangePasswordResponse')) },
    ...errorResponses({ 400: 'Password lama salah', 401: 'Token tidak valid' }),
  },
});

export const updateMeRoute = createRoute({
  method: 'patch',
  path: '/me',
  tags: ['User'],
  summary: 'Ubah profil sendiri',
  security: [{ bearerAuth: [] }],
  request: { body: json(UpdateUserSchema) },
  responses: {
    200: { description: 'Profil diperbarui', ...json(ok(UserSchema, 'UpdateMeResponse')) },
    ...errorResponses({ 401: 'Token tidak valid', 422: 'Validasi gagal' }),
  },
});

export const ListUsersQuerySchema = z.object({
  search: z.string().optional(),
  role: RoleEnum.optional(),
  organization_id: z.coerce.number().int().positive().optional(),
  is_active: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().positive().optional(),
  per_page: z.coerce.number().int().positive().max(200).optional(),
});

export const UserIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const listUsersRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['User Admin'],
  summary: 'Daftar user (butuh role admin)',
  security: [{ bearerAuth: [] }],
  request: { query: ListUsersQuerySchema },
  responses: {
    200: {
      description: 'Daftar user',
      ...json(ok(
        z.object({
          items: z.array(UserSchema),
          total: z.number(),
          page: z.number(),
          per_page: z.number(),
          total_pages: z.number(),
        }),
        'UserListResponse',
      )),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan admin' }),
  },
});

export const getUserRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['User Admin'],
  summary: 'Detail user',
  security: [{ bearerAuth: [] }],
  request: { params: UserIdParamSchema },
  responses: {
    200: { description: 'Detail user', ...json(ok(UserSchema, 'UserDetailResponse')) },
    ...errorResponses({ 404: 'Tidak ditemukan' }),
  },
});

export const updateUserRoute = createRoute({
  method: 'patch',
  path: '/{id}',
  tags: ['User Admin'],
  summary: 'Ubah user (butuh role admin)',
  security: [{ bearerAuth: [] }],
  request: { params: UserIdParamSchema, body: json(UpdateUserSchema) },
  responses: {
    200: { description: 'User diperbarui', ...json(ok(UserSchema, 'UpdateUserResponse')) },
    ...errorResponses({ 404: 'Tidak ditemukan', 422: 'Validasi gagal' }),
  },
});

export const resetPasswordRoute = createRoute({
  method: 'post',
  path: '/{id}/reset-password',
  tags: ['User Admin'],
  summary: 'Reset password user oleh admin',
  security: [{ bearerAuth: [] }],
  request: {
    params: UserIdParamSchema,
    body: json(z.object({ new_password: z.string().min(6) }).openapi('ResetPassword')),
  },
  responses: {
    200: { description: 'Password direset', ...json(ok(z.null(), 'ResetPasswordResponse')) },
    ...errorResponses({ 404: 'Tidak ditemukan' }),
  },
});

export const adminStatusRoute = createRoute({
  method: 'get',
  path: '/status',
  tags: ['Admin'],
  summary: 'Status sistem (Basic Auth)',
  security: [{ basicAuth: [] }],
  responses: {
    200: {
      description: 'Status sistem',
      ...json(ok(
        z.object({ status: z.string(), environment: z.string() }),
        'AdminStatusResponse',
      )),
    },
    401: {
      description: 'Basic auth gagal',
      content: { 'application/json': { schema: ApiErrorSchema } },
    },
  },
});
