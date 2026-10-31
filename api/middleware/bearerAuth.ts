import { verify } from 'hono/jwt';
import { createMiddleware } from 'hono/factory';
import { config } from '../config';
import { unauthorized } from '../shared/errors';

export type Role = 'pegawai' | 'verifikator' | 'atasan' | 'admin';

export type AuthUser = {
  id: string;
  username: string;
  role: Role;
};

const ROLES: Role[] = ['pegawai', 'verifikator', 'atasan', 'admin'];

const toRole = (value: unknown): Role =>
  ROLES.includes(value as Role) ? (value as Role) : 'pegawai';

declare module 'hono' {
  interface ContextVariableMap {
    user: AuthUser;
  }
}

/** Bearer JWT untuk endpoint yang membutuhkan user login. */
export const bearerAuth = createMiddleware(async (c, next) => {
  const header = c.req.header('Authorization');
  let token = header?.startsWith('Bearer ') ? header.slice(7).trim() : null;

  if (!token) {
    const cookie = c.req.header('Cookie');
    if (cookie) {
      const match = cookie.match(/(?:^|;\s*)(?:token|auth_token)=([^;]+)/);
      if (match?.[1]) token = decodeURIComponent(match[1]);
    }
  }

  if (!token) {
    token = c.req.query('token') ?? null;
  }

  if (!token) {
    throw unauthorized('Bearer token required');
  }

  try {
    const payload = await verify(token, config.jwt.secret, config.jwt.algorithm);

    if (typeof payload.sub !== 'string' || typeof payload.username !== 'string') {
      throw unauthorized('Invalid bearer token');
    }

    c.set('user', {
      id: payload.sub,
      username: payload.username,
      role: toRole(payload.role),
    });
    await next();
  } catch {
    throw unauthorized('Invalid bearer token');
  }
});
