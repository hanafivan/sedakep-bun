import { createMiddleware } from 'hono/factory';
import { forbidden, unauthorized } from '../shared/errors';
import type { AuthUser } from './bearerAuth';

/**
 * Guard peran. Dipakai setelah bearerAuth, jadi `c.get('user')` sudah terisi.
 * Admin dianggap memenuhi semua peran.
 */
export const requireRole = (...roles: Array<AuthUser['role']>) =>
  createMiddleware(async (c, next) => {
    const user = c.get('user');
    if (!user) throw unauthorized('Bearer token required');
    if (user.role !== 'admin' && !roles.includes(user.role)) {
      throw forbidden('Peran tidak memiliki akses');
    }
    await next();
  });
