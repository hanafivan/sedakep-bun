import { z } from '@hono/zod-openapi';
import { paginated } from '../../../shared/openapi';

/**
 * Schema request/response modul user.
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

export const ResetPasswordBodySchema = z.object({
  new_password: z.string().min(6),
}).openapi('ResetPassword');

export const AdminStatusResponseSchema = z.object({
  status: z.string(),
  environment: z.string(),
}).openapi('AdminStatusResponse');

export const LoginResponseSchema = z.object({
  token: z.string(),
  user: UserSchema,
}).openapi('LoginResponse');

export const UserListResponseSchema = paginated(UserSchema, 'UserListResponse');

