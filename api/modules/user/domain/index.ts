import { sign } from 'hono/jwt';
import {
  badRequest,
  conflict,
  forbidden,
  notFound,
  unauthorized,
} from '../../../shared/errors';
import {
  detectAlgo,
  hashPassword,
  needsRehash,
  verifyPassword,
} from '../../../shared/password-hash';
import {
  countUsers,
  countUsersByFilter,
  findUserById,
  findUserByNip,
  findUserByUsername,
  listUsers,
} from '../query';
import {
  deleteUser,
  insertUser,
  touchLastLogin,
  updateUser,
  updateUserPassword,
} from '../command';
import type { LoginInput, RegisterInput, UserResponse } from '../schema';
import type { NewUser, UserRow } from '../schema/types';

/** Domain = logika bisnis + orkestrasi. Tidak boleh ada SQL di sini. */

export const toUserResponse = (user: UserRow): UserResponse => ({
  id: user.id,
  username: user.username,
  name: user.name,
  nip: user.nip,
  grade: user.grade,
  role: user.role,
  organization_id: user.organization_id,
  employment_type: user.employment_type,
  is_active: user.is_active === 1,
  created_at: String(user.created_at),
});

const JWT_TTL_SECONDS = 8 * 60 * 60;

export class UserService {
  constructor(
    private readonly jwtSecret: string,
    private readonly jwtTtlSeconds = JWT_TTL_SECONDS,
  ) {}

  async register(input: RegisterInput): Promise<void> {
    const exists = await findUserByUsername(input.username);
    if (exists) throw conflict('Username sudah digunakan');

    if (input.nip) {
      const nipTaken = await findUserByNip(input.nip);
      if (nipTaken) throw conflict('NIP sudah terdaftar');
    }

    // Bootstrap: pada sistem kosong, pendaftar pertama menjadi admin.
    // Tanpa ini tidak ada jalan masuk ke menu manajemen.
    const isFirstUser = (await countUsers()) === 0;
    if (isFirstUser && input.role && input.role !== 'admin') {
      throw badRequest('Pendaftar pertama harus berperan admin');
    }

    const user: NewUser = {
      username: input.username,
      password_hash: await hashPassword(input.password),
      password_algo: 'argon2id',
      name: input.name?.trim() || input.username,
      nip: input.nip ?? null,
      role: isFirstUser ? 'admin' : (input.role ?? 'pegawai'),
      is_admin: isFirstUser,
    };

    await insertUser(user);
  }

  async login(input: LoginInput): Promise<{ token: string; user: UserResponse }> {
    const user = await findUserByUsername(input.username);
    if (!user) throw unauthorized('Username atau password salah');

    const valid = await verifyPassword(
      input.password,
      user.password_hash,
      user.password_algo,
    );
    if (!valid) throw unauthorized('Username atau password salah');

    if (!user.is_active) throw forbidden('Akun dinonaktifkan');

    if (needsRehash(user.password_algo)) {
      await updateUserPassword(user.id, await hashPassword(input.password), 'argon2id');
    }

    await touchLastLogin(user.id);

    const token = await sign(
      {
        sub: String(user.id),
        username: user.username,
        role: user.role,
        exp: Math.floor(Date.now() / 1000) + this.jwtTtlSeconds,
      },
      this.jwtSecret,
    );

    return { token, user: toUserResponse(user) };
  }

  async getById(id: number): Promise<UserResponse> {
    const user = await findUserById(id);
    if (!user) throw notFound('User tidak ditemukan');
    return toUserResponse(user);
  }

  async list(filter: {
    search?: string;
    role?: string;
    organizationId?: number;
    isActive?: boolean;
    page?: number;
    perPage?: number;
  }) {
    const perPage = Math.min(Math.max(filter.perPage ?? 25, 1), 200);
    const page = Math.max(filter.page ?? 1, 1);

    const [items, total] = await Promise.all([
      listUsers({ ...filter, limit: perPage, offset: (page - 1) * perPage }),
      countUsersByFilter(filter),
    ]);

    return {
      items: items.map(toUserResponse),
      total,
      page,
      per_page: perPage,
      total_pages: Math.ceil(total / perPage),
    };
  }

  async update(id: number, input: Record<string, unknown>): Promise<UserResponse> {
    const user = await findUserById(id);
    if (!user) throw notFound('User tidak ditemukan');

    const patch: Record<string, unknown> = {};
    const allowed = [
      'name',
      'nip',
      'grade',
      'email',
      'phone',
      'role',
      'organization_id',
      'position_id',
    ];
    for (const key of allowed) {
      if (input[key] !== undefined) patch[key] = input[key];
    }
    if (input.is_active !== undefined) patch.is_active = input.is_active ? 1 : 0;

    if (Object.keys(patch).length > 0) await updateUser(id, patch);
    return this.getById(id);
  }

  async changeOwnPassword(
    id: number,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await findUserById(id);
    if (!user) throw notFound('User tidak ditemukan');

    const valid = await verifyPassword(
      currentPassword,
      user.password_hash,
      user.password_algo,
    );
    if (!valid) throw unauthorized('Password lama salah');

    await updateUserPassword(id, await hashPassword(newPassword), 'argon2id');
  }

  async resetPassword(id: number, newPassword: string): Promise<void> {
    const user = await findUserById(id);
    if (!user) throw notFound('User tidak ditemukan');
    await updateUserPassword(id, await hashPassword(newPassword), 'argon2id');
  }

  async remove(id: number): Promise<void> {
    const user = await findUserById(id);
    if (!user) throw notFound('User tidak ditemukan');
    await deleteUser(id);
  }
}

export { detectAlgo };

