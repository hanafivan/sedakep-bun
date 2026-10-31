import { beforeAll, describe, expect, it } from 'bun:test';
import { app } from '../api/app';
import { getMySql } from '../api/db/mysql';
import { assertTestDatabase, describeDb } from './helpers/db';

/** Master data organisasi/jabatan: baca untuk user login, tulis hanya admin. */

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

const send = (method: string, path: string, payload: unknown, token?: string) =>
  request(path, { method, body: JSON.stringify(payload) }, token);

describeDb('master data', () => {
  let adminToken = '';
  let pegawaiToken = '';
  let orgId = 0;

  beforeAll(async () => {
    assertTestDatabase();
    const db = getMySql();
    await db.query('DELETE FROM users');
    await db.query('DELETE FROM positions');
    await db.query('DELETE FROM organizations');

    await send('POST', '/api/v1/users/register', { username: 'admin.master', password: 'password123', name: 'Admin Master' });
    await send('POST', '/api/v1/users/register', { username: 'pegawai.master', password: 'password123', name: 'Pegawai Master' });
    await db.query(`UPDATE users SET role='admin', is_admin=1 WHERE username='admin.master'`);
    await db.query(`UPDATE users SET role='pegawai', is_admin=0 WHERE username='pegawai.master'`);

    adminToken = (
      await json(await send('POST', '/api/v1/users/login', { username: 'admin.master', password: 'password123' }))
    ).data.token;
    pegawaiToken = (
      await json(await send('POST', '/api/v1/users/login', { username: 'pegawai.master', password: 'password123' }))
    ).data.token;
  });

  it('pegawai boleh membaca, tidak boleh menulis (403)', async () => {
    expect((await request('/api/v1/organizations', {}, pegawaiToken)).status).toBe(200);
    expect((await request('/api/v1/positions', {}, pegawaiToken)).status).toBe(200);
    const denied = await send('POST', '/api/v1/organizations', { code: 'X', name: 'X' }, pegawaiToken);
    expect(denied.status).toBe(403);
  });

  it('admin mengelola organisasi dan menolak kode ganda', async () => {
    const created = await json(
      await send('POST', '/api/v1/organizations', { code: 'SEK', name: 'Sekretariat' }, adminToken),
    );
    orgId = created.data.id;
    expect(orgId).toBeGreaterThan(0);

    const dup = await send('POST', '/api/v1/organizations', { code: 'SEK', name: 'Lain' }, adminToken);
    expect(dup.status).toBe(422);

    await send('PATCH', `/api/v1/organizations/${orgId}`, { name: 'Sekretariat (baru)' }, adminToken);
    const list = await json(await request('/api/v1/organizations', {}, adminToken));
    expect(list.data.find((o: Json) => o.id === orgId).name).toBe('Sekretariat (baru)');

    expect((await request(`/api/v1/organizations/${orgId}`, { method: 'DELETE' }, adminToken)).status).toBe(200);
  });

  it('admin mengelola jabatan dan menolak nama ganda', async () => {
    const created = await json(
      await send('POST', '/api/v1/positions', { name: 'Analis Kepegawaian', grade: 'III/a' }, adminToken),
    );
    expect(created.data.id).toBeGreaterThan(0);

    const dup = await send('POST', '/api/v1/positions', { name: 'Analis Kepegawaian' }, adminToken);
    expect(dup.status).toBe(422);

    const list = await json(await request('/api/v1/positions', {}, adminToken));
    expect(list.data.length).toBeGreaterThan(0);
  });
});
