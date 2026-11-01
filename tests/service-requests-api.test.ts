import { beforeAll, describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { app } from '../api/app';
import { getMySql } from '../api/db/mysql';
import { assertTestDatabase, describeDb } from './helpers/db';

/**
 * Modul layanan kepegawaian generik lewat HTTP (mis. pensiun): meta jenis,
 * field spesifik, dokumen berlabel, verifikasi, surat terbit, dan approval.
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

describeDb('layanan kepegawaian lewat API', () => {
  let adminToken = '';
  let pegawaiToken = '';
  let pegawai2Token = '';
  let requestId = 0;

  beforeAll(async () => {
    assertTestDatabase();
    const db = getMySql();
    await db.query('DELETE FROM users');

    await post('/api/v1/users/register', {
      username: 'admin.layan',
      password: 'password123',
      name: 'Admin Layanan',
    });
    await post('/api/v1/users/register', {
      username: 'pegawai.layan1',
      password: 'password123',
      name: 'Pegawai Layanan Satu',
    });
    await post('/api/v1/users/register', {
      username: 'pegawai.layan2',
      password: 'password123',
      name: 'Pegawai Layanan Dua',
    });
    await db.query(
      `UPDATE users SET role='admin', is_admin=1,
         nip='198001012006011050', employment_type='pns', tmt_date='2006-01-01'
       WHERE username='admin.layan'`,
    );
    await db.query(
      `UPDATE users SET role='pegawai', is_admin=0,
         nip='199201012015011051', employment_type='pns', tmt_date='2015-01-01'
       WHERE username='pegawai.layan1'`,
    );
    await db.query(
      `UPDATE users SET role='pegawai', is_admin=0,
         nip='199301012016011052', employment_type='pns', tmt_date='2016-01-01'
       WHERE username='pegawai.layan2'`,
    );

    adminToken = (
      await json(await post('/api/v1/users/login', { username: 'admin.layan', password: 'password123' }))
    ).data.token;
    pegawaiToken = (
      await json(await post('/api/v1/users/login', { username: 'pegawai.layan1', password: 'password123' }))
    ).data.token;
    pegawai2Token = (
      await json(await post('/api/v1/users/login', { username: 'pegawai.layan2', password: 'password123' }))
    ).data.token;
  });

  it('menyajikan metadata jenis layanan (termasuk pensiun)', async () => {
    const body = await json(await request('/api/v1/service-requests/meta', {}, pegawaiToken));
    const types = body.data.types.map((item: Json) => item.type);
    expect(types).toContain('pensiun');
    expect(types).toContain('pangkat');
  });

  it('membuat permohonan pensiun dengan field spesifik', async () => {
    const created = await json(
      await post(
        '/api/v1/service-requests',
        {
          service_type: 'pensiun',
          title: 'Usulan pensiun BUP',
          fields: { tempat_lahir: 'Sleman', pensiun: 'BUP' },
        },
        pegawaiToken,
      ),
    );
    requestId = created.data.id;
    expect(requestId).toBeGreaterThan(0);

    const detail = await json(await request(`/api/v1/service-requests/${requestId}`, {}, pegawaiToken));
    expect(detail.data.service_type).toBe('pensiun');
    expect(detail.data.fields.tempat_lahir).toBe('Sleman');
    expect(detail.data.status).toBe('submitted');
  });

  it('mengunggah dokumen berlabel dan menolak label asing', async () => {
    const form = new FormData();
    form.set('file', new File([new Uint8Array([37, 80, 68, 70])], 'foto.pdf', { type: 'application/pdf' }));
    form.set('label', 'foto');
    const uploaded = await json(
      await request(`/api/v1/service-requests/${requestId}/documents`, { method: 'POST', body: form }, pegawaiToken),
    );
    expect(uploaded.data.document_id).toBeGreaterThan(0);

    const bad = new FormData();
    bad.set('file', new File([new Uint8Array([37, 80, 68, 70])], 'x.pdf', { type: 'application/pdf' }));
    bad.set('label', 'tidak_ada');
    const rejected = await request(
      `/api/v1/service-requests/${requestId}/documents`,
      { method: 'POST', body: bad },
      pegawaiToken,
    );
    expect(rejected.status).toBe(422);
  });

  it('menolak approval/verifikasi oleh pegawai (403)', async () => {
    const approve = await post(`/api/v1/service-requests/${requestId}/approve`, { decision: 'accepted' }, pegawaiToken);
    expect(approve.status).toBe(403);
    const check = await post(`/api/v1/service-requests/${requestId}/checks`, { check_type: 'foto', result: 'ok' }, pegawaiToken);
    expect(check.status).toBe(403);
  });

  it('verifikasi, catat surat, lalu menyetujui lewat admin', async () => {
    await post(`/api/v1/service-requests/${requestId}/checks`, { check_type: 'foto', result: 'ok' }, adminToken);
    const letter = await json(
      await post(`/api/v1/service-requests/${requestId}/letters`, { letter_type: 'sphd', number: 'SPHD-1' }, adminToken),
    );
    expect(letter.data.id).toBeGreaterThan(0);

    const approved = await json(
      await post(`/api/v1/service-requests/${requestId}/approve`, { decision: 'accepted' }, adminToken),
    );
    expect(approved.data.status).toBe('approved');

    const detail = await json(await request(`/api/v1/service-requests/${requestId}`, {}, adminToken));
    expect(detail.data.checks).toHaveLength(1);
    expect(detail.data.letters).toHaveLength(1);
  });

  it('permohonan final tidak dapat diubah atau dihapus', async () => {
    const updated = await request(
      `/api/v1/service-requests/${requestId}`,
      { method: 'PATCH', body: JSON.stringify({ title: 'X' }) },
      pegawaiToken,
    );
    expect(updated.status).toBe(422);
    const removed = await request(`/api/v1/service-requests/${requestId}`, { method: 'DELETE' }, pegawaiToken);
    expect(removed.status).toBe(422);
  });

  it('pegawai lain tidak dapat melihat permohonan bukan miliknya', async () => {
    const view = await request(`/api/v1/service-requests/${requestId}`, {}, pegawai2Token);
    expect(view.status).toBe(422);
    const list = await json(await request('/api/v1/service-requests', {}, pegawai2Token));
    expect(list.data.total).toBe(0);
  });
});

describe('guard arsitektur — layanan kepegawaian', () => {
  it('domain tidak berisi SQL mentah', () => {
    for (const rel of [
      '../api/modules/service-requests/domain/index.ts',
      '../api/modules/service-requests/domain/service-types.ts',
    ]) {
      const source = readFileSync(new URL(rel, import.meta.url), 'utf8');
      expect(source).not.toMatch(/\b(SELECT|INSERT|UPDATE|DELETE|CREATE TABLE|PRAGMA)\b/);
    }
  });
});
