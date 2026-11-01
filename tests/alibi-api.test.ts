import { beforeAll, describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { app } from '../api/app';
import { getMySql } from '../api/db/mysql';
import { assertTestDatabase, describeDb } from './helpers/db';

/**
 * Modul alibi lewat HTTP: approval tiga tingkat (admin → atasan 1 → atasan 2),
 * pembatalan, unggah berkas, dan scoping kepemilikan.
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

const patch = (path: string, payload: unknown, token?: string) =>
  request(path, { method: 'PATCH', body: JSON.stringify(payload) }, token);

describeDb('alibi lewat API', () => {
  let adminToken = '';
  let pegawaiToken = '';
  let pegawai2Token = '';
  let alibiId = 0;

  beforeAll(async () => {
    assertTestDatabase();
    const db = getMySql();
    await db.query('DELETE FROM users');

    await post('/api/v1/users/register', {
      username: 'admin.alibi',
      password: 'password123',
      name: 'Admin Alibi',
    });
    await post('/api/v1/users/register', {
      username: 'pegawai.alibi1',
      password: 'password123',
      name: 'Pegawai Alibi Satu',
    });
    await post('/api/v1/users/register', {
      username: 'pegawai.alibi2',
      password: 'password123',
      name: 'Pegawai Alibi Dua',
    });
    await db.query(
      `UPDATE users SET role='admin', is_admin=1,
         nip='198001012006011020', employment_type='pns', tmt_date='2006-01-01'
       WHERE username='admin.alibi'`,
    );
    await db.query(
      `UPDATE users SET role='pegawai', is_admin=0,
         nip='199201012015011021', employment_type='pns', tmt_date='2015-01-01'
       WHERE username='pegawai.alibi1'`,
    );
    await db.query(
      `UPDATE users SET role='pegawai', is_admin=0,
         nip='199301012016011022', employment_type='pns', tmt_date='2016-01-01'
       WHERE username='pegawai.alibi2'`,
    );

    adminToken = (
      await json(
        await post('/api/v1/users/login', { username: 'admin.alibi', password: 'password123' }),
      )
    ).data.token;
    pegawaiToken = (
      await json(
        await post('/api/v1/users/login', { username: 'pegawai.alibi1', password: 'password123' }),
      )
    ).data.token;
    pegawai2Token = (
      await json(
        await post('/api/v1/users/login', { username: 'pegawai.alibi2', password: 'password123' }),
      )
    ).data.token;
  });

  it('mengajukan alibi dengan snapshot pegawai', async () => {
    const created = await json(
      await post(
        '/api/v1/alibi-requests',
        {
          alibi_type: 'Tidak masuk',
          alibi_date: '2035-03-01',
          day_count: '1',
          reason: 'Keperluan keluarga',
        },
        pegawaiToken,
      ),
    );
    alibiId = created.data.id;
    expect(alibiId).toBeGreaterThan(0);

    const detail = await json(await request(`/api/v1/alibi-requests/${alibiId}`, {}, pegawaiToken));
    expect(detail.data.status).toBe('submitted');
    expect(detail.data.admin_decision).toBe('pending');
    expect(detail.data.nip).toBe('199201012015011021');
  });

  it('menolak approval admin oleh pegawai (403)', async () => {
    const denied = await post(
      `/api/v1/alibi-requests/${alibiId}/approve/admin`,
      { decision: 'accepted' },
      pegawaiToken,
    );
    expect(denied.status).toBe(403);
  });

  it('menjalankan approval admin → atasan 1 → atasan 2', async () => {
    const admin = await json(
      await post(
        `/api/v1/alibi-requests/${alibiId}/approve/admin`,
        { decision: 'accepted' },
        adminToken,
      ),
    );
    expect(admin.data.status).toBe('in_review');

    const level1 = await json(
      await post(
        `/api/v1/alibi-requests/${alibiId}/approve/level/1`,
        { decision: 'accepted' },
        adminToken,
      ),
    );
    expect(level1.data.status).toBe('in_review');

    const level2 = await json(
      await post(
        `/api/v1/alibi-requests/${alibiId}/approve/level/2`,
        { decision: 'accepted' },
        adminToken,
      ),
    );
    expect(level2.data.status).toBe('approved');
  });

  it('mengunggah berkas alibi setelah final', async () => {
    const form = new FormData();
    form.set('file', new File([new Uint8Array([37, 80, 68, 70])], 'alibi.pdf', {
      type: 'application/pdf',
    }));
    const uploaded = await json(
      await request(`/api/v1/alibi-requests/${alibiId}/file`, { method: 'POST', body: form }, adminToken),
    );
    expect(uploaded.data.document_id).toBeGreaterThan(0);
  });

  it('alibi final tidak dapat diubah atau dihapus', async () => {
    const updated = await patch(`/api/v1/alibi-requests/${alibiId}`, { reason: 'X' }, pegawaiToken);
    expect(updated.status).toBe(422);
    const removed = await request(`/api/v1/alibi-requests/${alibiId}`, { method: 'DELETE' }, pegawaiToken);
    expect(removed.status).toBe(422);
  });

  it('membatalkan alibi yang belum final', async () => {
    const created = await json(
      await post('/api/v1/alibi-requests', { alibi_type: 'Terlambat' }, pegawaiToken),
    );
    const id = created.data.id;
    const canceled = await json(
      await post(`/api/v1/alibi-requests/${id}/cancel`, { note: 'uji batal' }, pegawaiToken),
    );
    expect(canceled.data.status).toBe('cancelled');
  });

  it('pegawai lain tidak dapat melihat alibi bukan miliknya', async () => {
    const view = await request(`/api/v1/alibi-requests/${alibiId}`, {}, pegawai2Token);
    expect(view.status).toBe(422);
    const list = await json(await request('/api/v1/alibi-requests', {}, pegawai2Token));
    expect(list.data.total).toBe(0);
  });
});

describe('guard arsitektur — alibi', () => {
  it('domain tidak berisi SQL mentah', () => {
    const source = readFileSync(
      new URL('../api/modules/alibi/domain/index.ts', import.meta.url),
      'utf8',
    );
    expect(source).not.toMatch(/\b(SELECT|INSERT|UPDATE|DELETE|CREATE TABLE|PRAGMA)\b/);
  });
});
