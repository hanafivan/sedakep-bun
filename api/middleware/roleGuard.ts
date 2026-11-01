import { createMiddleware } from 'hono/factory';
import { forbidden, unauthorized } from '../shared/errors';
import type { AuthUser, Role } from './bearerAuth';

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

/**
 * Cek apakah peran termasuk staf/atasan yang berhak melihat data permohonan
 * lintas pegawai (admin, verifikator, atasan).
 */
export const canSeeAll = (role: Role | string): boolean =>
  role === 'admin' || role === 'verifikator' || role === 'atasan';

export const isStaffRole = canSeeAll;

