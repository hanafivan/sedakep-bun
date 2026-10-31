import { beforeAll, describe, expect, it } from 'bun:test';
import { app } from '../api/app';
import { getMySql } from '../api/db/mysql';
import { assertTestDatabase, describeDb } from './helpers/db';

/** Manajemen pengguna (admin) dan profil sendiri. */

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
const patch = (path: string, payload: unknown, token?: string) =>
  request(path, { method: 'PATCH', body: JSON.stringify(payload) }, token);

describeDb('manajemen pengguna', () => {
  let adminToken = '';
  let pegawaiToken = '';
  let pegawaiId = 0;

  beforeAll(async () => {
    assertTestDatabase();
    const db = getMySql();
    await db.query('DELETE FROM users');

    await post('/api/v1/users/register', { username: 'admin.user', password: 'password123', name: 'Admin User' });
    await post('/api/v1/users/register', { username: 'pegawai.user', password: 'password123', name: 'Pegawai User' });
    await db.query(`UPDATE users SET role='admin', is_admin=1 WHERE username='admin.user'`);
    await db.query(`UPDATE users SET role='pegawai', is_admin=0, nip='199201012015011071' WHERE username='pegawai.user'`);

    adminToken = (
      await json(await post('/api/v1/users/login', { username: 'admin.user', password: 'password123' }))
    ).data.token;
    const login = await json(
      await post('/api/v1/users/login', { username: 'pegawai.user', password: 'password123' }),
    );
    pegawaiToken = login.data.token;
    pegawaiId = login.data.user.id;
  });

  it('menolak pegawai di endpoint admin pengguna (403)', async () => {
    expect((await request('/api/v1/users', {}, pegawaiToken)).status).toBe(403);
    expect((await patch(`/api/v1/users/${pegawaiId}`, { role: 'admin' }, pegawaiToken)).status).toBe(403);
  });

  it('admin dapat mendaftar dan mengubah peran pengguna', async () => {
    const list = await json(await request('/api/v1/users?per_page=50', {}, adminToken));
    expect(list.data.total).toBeGreaterThanOrEqual(2);

    const updated = await json(await patch(`/api/v1/users/${pegawaiId}`, { role: 'verifikator' }, adminToken));
    expect(updated.data.role).toBe('verifikator');

    const detail = await json(await request(`/api/v1/users/${pegawaiId}`, {}, adminToken));
    expect(detail.data.role).toBe('verifikator');
  });

  it('admin dapat mereset sandi pengguna', async () => {
    const reset = await request(
      `/api/v1/users/${pegawaiId}/reset-password`,
      { method: 'POST', body: JSON.stringify({ new_password: 'barusekali123' }) },
      adminToken,
    );
    expect(reset.status).toBe(200);

    const relogin = await post('/api/v1/users/login', { username: 'pegawai.user', password: 'barusekali123' });
    expect(relogin.status).toBe(200);
  });

  it('pengguna dapat mengubah profilnya sendiri', async () => {
    const updated = await json(await patch(`/api/v1/users/me`, { name: 'Nama Baru', grade: 'III/b' }, pegawaiToken));
    expect(updated.data.name).toBe('Nama Baru');
    const me = await json(await request('/api/v1/users/me', {}, pegawaiToken));
    expect(me.data.grade).toBe('III/b');
  });
});
