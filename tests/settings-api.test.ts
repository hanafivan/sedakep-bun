import { beforeAll, describe, expect, it } from 'bun:test';
import { app } from '../api/app';
import { getMySql } from '../api/db/mysql';
import { assertTestDatabase, describeDb } from './helpers/db';

/**
 * Pengaturan umum: CRUD key/value `settings`, admin saja, dengan audit dan
 * penyamaran nilai rahasia. Kunci `scheduler.*` sengaja hanya baca.
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

const send = (method: string, path: string, payload: unknown, token?: string) =>
  request(path, { method, body: JSON.stringify(payload) }, token);

const countAudit = async (action: string): Promise<number> => {
  const result = await getMySql().query(
    'SELECT COUNT(*) AS c FROM audit_logs WHERE entity_table = ? AND action = ?',
    ['settings', action],
  );
  const rows = (result as unknown as [Array<{ c: number }>])[0];
  return Number(rows[0]?.c ?? 0);
};

describeDb('pengaturan umum', () => {
  let adminToken = '';
  let pegawaiToken = '';

  beforeAll(async () => {
    assertTestDatabase();
    const db = getMySql();
    await db.query('DELETE FROM users');

    await send('POST', '/api/v1/users/register', { username: 'admin.settings', password: 'password123', name: 'Admin Settings' });
    await send('POST', '/api/v1/users/register', { username: 'pegawai.settings', password: 'password123', name: 'Pegawai Settings' });
    await db.query(`UPDATE users SET role='admin', is_admin=1 WHERE username='admin.settings'`);
    await db.query(`UPDATE users SET role='pegawai', is_admin=0 WHERE username='pegawai.settings'`);

    adminToken = (
      await json(await send('POST', '/api/v1/users/login', { username: 'admin.settings', password: 'password123' }))
    ).data.token;
    pegawaiToken = (
      await json(await send('POST', '/api/v1/users/login', { username: 'pegawai.settings', password: 'password123' }))
    ).data.token;
  });

  it('menolak pegawai di seluruh endpoint pengaturan (403)', async () => {
    expect((await request('/api/v1/settings', {}, pegawaiToken)).status).toBe(403);
    expect((await send('PUT', '/api/v1/settings/test.settings.x', { value: '1' }, pegawaiToken)).status).toBe(403);
    expect((await request('/api/v1/settings/test.settings.x', { method: 'DELETE' }, pegawaiToken)).status).toBe(403);
  });

  it('admin membuat, membaca, dan menghapus pengaturan', async () => {
    await getMySql().query("DELETE FROM settings WHERE `key` LIKE 'test.settings.%'");

    const created = await send(
      'PUT',
      '/api/v1/settings/test.settings.plain',
      { value: 'halo', description: 'uji' },
      adminToken,
    );
    expect(created.status).toBe(200);

    const list = await json(await request('/api/v1/settings?prefix=test.settings.', {}, adminToken));
    expect(list.data.find((row: Json) => row.key === 'test.settings.plain').value).toBe('halo');

    const one = await json(await request('/api/v1/settings/test.settings.plain', {}, adminToken));
    expect(one.data.value).toBe('halo');
    expect(one.data.readonly).toBe(false);

    const removed = await request('/api/v1/settings/test.settings.plain', { method: 'DELETE' }, adminToken);
    expect(removed.status).toBe(200);
    const after = await json(await request('/api/v1/settings?prefix=test.settings.', {}, adminToken));
    expect(after.data.find((row: Json) => row.key === 'test.settings.plain')).toBeUndefined();
  });

  it('menutup nilai rahasia di daftar tetapi membukanya di detail', async () => {
    await send('PUT', '/api/v1/settings/test.settings.secret_token', { value: 'rahasia' }, adminToken);

    const list = await json(await request('/api/v1/settings?prefix=test.settings.', {}, adminToken));
    const row = list.data.find((item: Json) => item.key === 'test.settings.secret_token');
    expect(row.secret).toBe(true);
    expect(row.value).toBe('••••••');

    const one = await json(await request('/api/v1/settings/test.settings.secret_token', {}, adminToken));
    expect(one.data.value).toBe('rahasia');
  });

  it('menolak kunci tidak valid dan kunci sistem', async () => {
    expect((await send('PUT', '/api/v1/settings/test.settings.BAD', { value: 'x' }, adminToken)).status).toBe(422);
    expect(
      (await send('PUT', '/api/v1/settings/scheduler.rollover.2099', { value: 'x' }, adminToken)).status,
    ).toBe(422);
  });

  it('mencatat audit perubahan dan penghapusan', async () => {
    const before = await countAudit('setting_update');
    await send('PUT', '/api/v1/settings/test.settings.audited', { value: '1' }, adminToken);
    expect(await countAudit('setting_update')).toBeGreaterThan(before);

    await request('/api/v1/settings/test.settings.audited', { method: 'DELETE' }, adminToken);
    expect(await countAudit('setting_delete')).toBeGreaterThan(0);
  });
});
