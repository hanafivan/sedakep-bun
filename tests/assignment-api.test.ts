import { beforeAll, describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { app } from '../api/app';
import { getMySql } from '../api/db/mysql';
import { assertTestDatabase, describeDb } from './helpers/db';

/**
 * Modul surat tugas lewat HTTP.
 *
 * Menjaga cerminan legacy: surat + anggota/keterangan/tembusan (1:N),
 * approval current-state khusus admin, penomoran manual hanya setelah
 * disetujui, dan berkas surat hanya setelah disetujui.
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

describeDb('surat tugas lewat API', () => {
  let adminToken = '';
  let p1Token = '';
  let p2Token = '';
  let letterId = 0;

  beforeAll(async () => {
    assertTestDatabase();
    const db = getMySql();
    await db.query('DELETE FROM users');

    await post('/api/v1/users/register', {
      username: 'admin.stug',
      password: 'password123',
      name: 'Admin Stug',
    });
    await post('/api/v1/users/register', {
      username: 'pegawai.stug1',
      password: 'password123',
      name: 'Pegawai Stug Satu',
    });
    await post('/api/v1/users/register', {
      username: 'pegawai.stug2',
      password: 'password123',
      name: 'Pegawai Stug Dua',
    });
    await db.query(
      `UPDATE users SET role='admin', is_admin=1,
         nip='198001012006011010', employment_type='pns', tmt_date='2006-01-01'
       WHERE username='admin.stug'`,
    );
    await db.query(
      `UPDATE users SET role='pegawai', is_admin=0,
         nip='199001012015011011', employment_type='pns', tmt_date='2015-01-01'
       WHERE username='pegawai.stug1'`,
    );
    await db.query(
      `UPDATE users SET role='pegawai', is_admin=0,
         nip='199101012016011012', employment_type='pns', tmt_date='2016-01-01'
       WHERE username='pegawai.stug2'`,
    );

    adminToken = (
      await json(
        await post('/api/v1/users/login', { username: 'admin.stug', password: 'password123' }),
      )
    ).data.token;
    p1Token = (
      await json(
        await post('/api/v1/users/login', { username: 'pegawai.stug1', password: 'password123' }),
      )
    ).data.token;
    p2Token = (
      await json(
        await post('/api/v1/users/login', { username: 'pegawai.stug2', password: 'password123' }),
      )
    ).data.token;
  });

  it('membuat surat tugas dengan status submitted', async () => {
    const created = await json(
      await post(
        '/api/v1/assignment-letters',
        {
          code: 'ST-01',
          content: 'Melaksanakan tugas uji coba',
          place: 'Kantor Kemenag Sleman',
          start_date: '2035-02-01',
          end_date: '2035-02-02',
        },
        p1Token,
      ),
    );
    letterId = created.data.id;
    expect(letterId).toBeGreaterThan(0);

    const detail = await json(
      await request(`/api/v1/assignment-letters/${letterId}`, {}, p1Token),
    );
    expect(detail.data.status).toBe('submitted');
    expect(detail.data.number_display).toBeNull();
    expect(detail.data.members).toHaveLength(0);
  });

  it('menambah anggota, keterangan, dan tembusan', async () => {
    const member = await json(
      await post(
        `/api/v1/assignment-letters/${letterId}/members`,
        { name: 'Anggota Satu', nip: '199501012019011009', grade: 'III/a', position: 'Staf' },
        p1Token,
      ),
    );
    expect(member.data.id).toBeGreaterThan(0);

    await post(`/api/v1/assignment-letters/${letterId}/notes`, { note: 'Keterangan uji' }, p1Token);
    await post(`/api/v1/assignment-letters/${letterId}/copies`, { copy_to: 'Kepala Kantor' }, p1Token);

    const detail = await json(
      await request(`/api/v1/assignment-letters/${letterId}`, {}, p1Token),
    );
    expect(detail.data.members).toHaveLength(1);
    expect(detail.data.notes).toHaveLength(1);
    expect(detail.data.copies).toHaveLength(1);
  });

  it('menolak approval dan pengelolaan oleh pegawai', async () => {
    const approve = await post(
      `/api/v1/assignment-letters/${letterId}/approve`,
      { decision: 'accepted' },
      p1Token,
    );
    expect(approve.status).toBe(403);
  });

  it('menolak input nomor sebelum disetujui', async () => {
    const early = await post(
      `/api/v1/assignment-letters/${letterId}/number`,
      { letter_number: '123' },
      adminToken,
    );
    expect(early.status).toBe(422);
  });

  it('admin menyetujui lalu input nomor dan unggah berkas', async () => {
    const approved = await json(
      await post(
        `/api/v1/assignment-letters/${letterId}/approve`,
        { decision: 'accepted' },
        adminToken,
      ),
    );
    expect(approved.data.status).toBe('approved');

    const numbered = await json(
      await post(
        `/api/v1/assignment-letters/${letterId}/number`,
        { letter_number: '123' },
        adminToken,
      ),
    );
    expect(numbered.data.letter_number).toBe('123');
    expect(numbered.data.number_display).toMatch(/^B-123\/Kk\.12\.04\/ST-01\/\d{2}\/\d{4}$/);

    const form = new FormData();
    form.set('file', new File([new Uint8Array([37, 80, 68, 70])], 'surtug.pdf', {
      type: 'application/pdf',
    }));
    const uploaded = await json(
      await request(`/api/v1/assignment-letters/${letterId}/file`, { method: 'POST', body: form }, adminToken),
    );
    expect(uploaded.data.document_id).toBeGreaterThan(0);
  });

  it('surat final tidak dapat diubah, ditambah anggota, atau dihapus', async () => {
    const updated = await patch(
      `/api/v1/assignment-letters/${letterId}`,
      { place: 'Tempat Lain' },
      adminToken,
    );
    expect(updated.status).toBe(422);

    const member = await post(
      `/api/v1/assignment-letters/${letterId}/members`,
      { name: 'Anggota Baru' },
      adminToken,
    );
    expect(member.status).toBe(422);

    const removed = await request(
      `/api/v1/assignment-letters/${letterId}`,
      { method: 'DELETE' },
      adminToken,
    );
    expect(removed.status).toBe(422);
  });

  it('pegawai lain tidak dapat melihat surat bukan miliknya', async () => {
    const view = await request(`/api/v1/assignment-letters/${letterId}`, {}, p2Token);
    expect(view.status).toBe(422);

    const list = await json(
      await request('/api/v1/assignment-letters', {}, p2Token),
    );
    expect(list.data.total).toBe(0);
  });

  it('membatalkan surat belum disetujui dan menyertakan identitas instansi', async () => {
    const created = await json(
      await post('/api/v1/assignment-letters', { code: 'ST-BATAL' }, p1Token),
    );
    const id = created.data.id;

    const detail = await json(
      await request(`/api/v1/assignment-letters/${id}`, {}, p1Token),
    );
    expect(detail.data.instance).toBeDefined();

    const canceled = await json(
      await request(`/api/v1/assignment-letters/${id}/cancel`, { method: 'POST' }, p1Token),
    );
    expect(canceled.data.status).toBe('cancelled');

    const after = await json(
      await request(`/api/v1/assignment-letters/${id}`, {}, p1Token),
    );
    expect(after.data.status).toBe('cancelled');
  });
});

describe('guard arsitektur — surat tugas', () => {
  it('domain tidak berisi SQL mentah', () => {
    const source = readFileSync(
      new URL('../api/modules/assignments/domain/index.ts', import.meta.url),
      'utf8',
    );
    expect(source).not.toMatch(/\b(SELECT|INSERT|UPDATE|DELETE|CREATE TABLE|PRAGMA)\b/);
  });
});
