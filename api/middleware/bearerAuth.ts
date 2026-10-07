import { verify } from 'hono/jwt';
import { createMiddleware } from 'hono/factory';
import { config } from '../config';
import { unauthorized } from '../shared/errors';

export type AuthUser = {
  id: string;
  username: string;
};

declare module 'hono' {
  interface ContextVariableMap {
    user: AuthUser;
  }
}

/** Bearer JWT untuk endpoint yang membutuhkan user login. */
export const bearerAuth = createMiddleware(async (c, next) => {
  const header = c.req.header('Authorization');

  if (!header?.startsWith('Bearer ')) {
    throw unauthorized('Bearer token required');
  }

  const token = header.slice(7).trim();
  if (!token) throw unauthorized('Bearer token required');

  try {
    const payload = await verify(token, config.jwt.secret, config.jwt.algorithm);

    if (typeof payload.sub !== 'string' || typeof payload.username !== 'string') {
      throw unauthorized('Invalid bearer token');
    }

    c.set('user', { id: payload.sub, username: payload.username });
    await next();
  } catch {
    throw unauthorized('Invalid bearer token');
  }
});
