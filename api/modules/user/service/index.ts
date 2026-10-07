import type { Database } from 'bun:sqlite';
import { sign } from 'hono/jwt';
import { conflict, notFound, unauthorized } from '../../../shared/errors';
import { insertUser } from '../command';
import { findUserById, findUserByUsername } from '../query';
import type { LoginInput, RegisterInput, UserResponse } from '../schema';
import type { UserRow } from '../schema/types';

/** Service = logika bisnis + orkestrasi. Tidak boleh ada SQL di sini. */

const toUserResponse = (user: UserRow): UserResponse => ({
  id: user.id,
  username: user.username,
  createdAt: user.created_at,
});

export class UserService {
  constructor(
    private readonly db: Database,
    private readonly jwtSecret: string,
  ) {}

  async register(input: RegisterInput): Promise<void> {
    const exists = findUserByUsername(this.db, input.username);
    if (exists) throw conflict('Username sudah digunakan');

    const hashedPassword = await Bun.password.hash(input.password);
    insertUser(this.db, {
      id: crypto.randomUUID(),
      username: input.username,
      password: hashedPassword,
    });
  }

  async login(input: LoginInput) {
    const user = findUserByUsername(this.db, input.username);
    const passwordValid =
      user && (await Bun.password.verify(input.password, user.password));

    if (!user || !passwordValid) throw unauthorized('Username atau password salah');

    const token = await sign(
      {
        sub: user.id,
        username: user.username,
        exp: Math.floor(Date.now() / 1000) + 60 * 60,
      },
      this.jwtSecret,
    );

    return { token, user: toUserResponse(user) };
  }

  getById(id: string): UserResponse {
    const user = findUserById(this.db, id);
    if (!user) throw notFound('User tidak ditemukan');
    return toUserResponse(user);
  }
}
