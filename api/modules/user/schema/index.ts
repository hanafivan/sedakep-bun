import { z } from 'zod';
import { createRoute } from '@hono/zod-openapi';

export const RegisterSchema = z.object({
  username: z.string().min(3, 'Username minimal 3 karakter').max(50),
  password: z.string().min(6, 'Password minimal 6 karakter'),
}).openapi('RegisterRequest');

export const LoginSchema = z.object({
  username: z.string().min(1, 'Username wajib diisi'),
  password: z.string().min(1, 'Password wajib diisi'),
}).openapi('LoginRequest');

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;

export const UserSchema = z.object({
  id: z.string(),
  username: z.string(),
  createdAt: z.string(),
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
