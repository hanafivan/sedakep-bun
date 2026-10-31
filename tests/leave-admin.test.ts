import { beforeAll, describe, expect, it } from 'bun:test';
import { app } from '../api/app';
import { getMySql } from '../api/db/mysql';
import { assertTestDatabase, describeDb } from './helpers/db';

/**
 * Otorisasi administrasi cuti.
 *
 * Seluruh `/leave/admin/*` hanya untuk admin. Pegawai harus kena 403 di setiap
 * endpoint — bukan 200 yang tampak "berhasil" karena data kosong.
 */

type Json = Record<string, any>;

const json = async (response: Response): Promise<Json> => (await response.json()) as Json;

const request = (path: string, options: RequestInit = {}, token?: string) => {
  const headers = new Headers(options.headers);
  if (typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return app.request(path, { ...options, headers });
};

const post = (path: string, payload: unknown, token?: string) =>
  request(path, { method: 'POST', body: JSON.stringify(payload) }, token);

const ADMIN_PATHS = [
  '/api/v1/leave/admin/quota-book',
  '/api/v1/leave/admin/users',
  '/api/v1/leave/admin/quota-audit',
  '/api/v1/leave/admin/pppk-tmt',
  '/api/v1/leave/admin/closure-periods',
  '/api/v1/leave/admin/instance',
  '/api/v1/leave/admin/yearly-summary',
];

describeDb('otorisasi admin cuti', () => {
  let adminToken = '';
  let pegawaiToken = '';

  beforeAll(async () => {
    assertTestDatabase();
    const db = getMySql();
    await db.query('DELETE FROM users');

    await post('/api/v1/users/register', {
      username: 'admin.otorisasi',
      password: 'password123',
      name: 'Admin Otorisasi',
    });
    await post('/api/v1/users/register', {
      username: 'pegawai.otorisasi',
      password: 'password123',
      name: 'Pegawai Otorisasi',
    });
    await db.query(
      `UPDATE users SET role='admin', is_admin=1,
         nip='198501012010011001', employment_type='pns', tmt_date='2010-01-01'
       WHERE username='admin.otorisasi'`,
    );
    await db.query(
      `UPDATE users SET role='pegawai', is_admin=0,
         nip='199201012015011002', employment_type='pns', tmt_date='2015-01-01'
       WHERE username='pegawai.otorisasi'`,
    );

    adminToken = (
      await json(
        await post('/api/v1/users/login', {
          username: 'admin.otorisasi',
          password: 'password123',
        }),
      )
    ).data.token;
    pegawaiToken = (
      await json(
        await post('/api/v1/users/login', {
          username: 'pegawai.otorisasi',
          password: 'password123',
        }),
      )
    ).data.token;
  });

  it('menolak pegawai di seluruh endpoint admin dengan 403', async () => {
    for (const path of ADMIN_PATHS) {
      const response = await request(path, {}, pegawaiToken);
      expect(response.status).toBe(403);
    }
  });

  it('meloloskan admin di endpoint admin yang sama', async () => {
    for (const path of ADMIN_PATHS) {
      const response = await request(path, {}, adminToken);
      expect(response.status).toBe(200);
    }
  });

  it('menolak endpoint admin tanpa token (401, bukan 403)', async () => {
    const response = await request('/api/v1/leave/admin/users');
    expect(response.status).toBe(401);
  });
});
