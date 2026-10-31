import { beforeAll, describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { app } from '../api/app';
import { getMySql } from '../api/db/mysql';
import { assertTestDatabase, describeDb } from './helpers/db';

/**
 * Modul disposisi lewat HTTP: surat masuk, disposisi pelaksana, final,
 * referensi, klasifikasi, finalisasi, dan berkas. Staf saja (pegawai 403).
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

describeDb('disposisi lewat API', () => {
  let adminToken = '';
  let pegawaiToken = '';
  let letterId = 0;

  beforeAll(async () => {
    assertTestDatabase();
    const db = getMySql();
    await db.query('DELETE FROM users');
    // Surat masuk (created_by ON DELETE SET NULL) dan klasifikasi tidak ikut
    // terhapus lewat users, jadi dibersihkan eksplisit agar kode unik tidak bentrok.
    await db.query('DELETE FROM incoming_letters');
    await db.query('DELETE FROM letter_classifications');

    await post('/api/v1/users/register', {
      username: 'admin.dispo',
      password: 'password123',
      name: 'Admin Dispo',
    });
    await post('/api/v1/users/register', {
      username: 'pegawai.dispo',
      password: 'password123',
      name: 'Pegawai Dispo',
    });
    await db.query(
      `UPDATE users SET role='admin', is_admin=1,
         nip='198001012006011030', employment_type='pns', tmt_date='2006-01-01'
       WHERE username='admin.dispo'`,
    );
    await db.query(
      `UPDATE users SET role='pegawai', is_admin=0,
         nip='199201012015011031', employment_type='pns', tmt_date='2015-01-01'
       WHERE username='pegawai.dispo'`,
    );

    adminToken = (
      await json(
        await post('/api/v1/users/login', { username: 'admin.dispo', password: 'password123' }),
      )
    ).data.token;
    pegawaiToken = (
      await json(
        await post('/api/v1/users/login', { username: 'pegawai.dispo', password: 'password123' }),
      )
    ).data.token;
  });

  it('menolak pegawai di endpoint disposisi (403)', async () => {
    const response = await request('/api/v1/incoming-letters', {}, pegawaiToken);
    expect(response.status).toBe(403);
  });

  it('mencatat surat masuk', async () => {
    const created = await json(
      await post(
        '/api/v1/incoming-letters',
        {
          agenda_number: '900',
          letter_number: 'B-123/Un.01/2026',
          origin: 'Kantor Wilayah',
          content: 'Undangan rapat',
          received_date: '2035-04-01',
        },
        adminToken,
      ),
    );
    letterId = created.data.id;
    expect(letterId).toBeGreaterThan(0);

    const detail = await json(await request(`/api/v1/incoming-letters/${letterId}`, {}, adminToken));
    expect(detail.data.status).toBe('baru');
    expect(detail.data.dispositions).toHaveLength(0);
  });

  it('menambah disposisi, mengubah status, dan mencatat final + referensi', async () => {
    const created = await json(
      await post(
        `/api/v1/incoming-letters/${letterId}/dispositions`,
        { target_name: 'Kasubbag TU', instruction: 'Untuk ditindaklanjuti' },
        adminToken,
      ),
    );
    const dispositionId = created.data.id;
    expect(dispositionId).toBeGreaterThan(0);

    await patch(
      `/api/v1/incoming-letters/${letterId}/dispositions/${dispositionId}`,
      { status: 'accepted' },
      adminToken,
    );

    await post(`/api/v1/incoming-letters/${letterId}/finals`, { name: 'Kepala Kantor', instruction: 'Setuju' }, adminToken);
    await post(`/api/v1/incoming-letters/${letterId}/references`, { reference_text: 'Surat edaran no. 5' }, adminToken);

    const detail = await json(await request(`/api/v1/incoming-letters/${letterId}`, {}, adminToken));
    expect(detail.data.dispositions).toHaveLength(1);
    expect(detail.data.dispositions[0].status).toBe('accepted');
    expect(detail.data.finals).toHaveLength(1);
    expect(detail.data.references).toHaveLength(1);
  });

  it('mengunggah berkas surat masuk', async () => {
    const form = new FormData();
    form.set('file', new File([new Uint8Array([37, 80, 68, 70])], 'surat.pdf', {
      type: 'application/pdf',
    }));
    form.set('field', 'sm');
    const uploaded = await json(
      await request(`/api/v1/incoming-letters/${letterId}/file`, { method: 'POST', body: form }, adminToken),
    );
    expect(uploaded.data.document_id).toBeGreaterThan(0);
  });

  it('memfinalisasi surat masuk', async () => {
    const result = await json(
      await request(`/api/v1/incoming-letters/${letterId}/finalize`, { method: 'POST' }, adminToken),
    );
    expect(result.data.status).toBe('selesai');
    const detail = await json(await request(`/api/v1/incoming-letters/${letterId}`, {}, adminToken));
    expect(detail.data.status).toBe('selesai');
    expect(detail.data.finalized_at).not.toBeNull();
  });

  it('mengelola klasifikasi surat dan menolak kode ganda', async () => {
    const created = await json(
      await post('/api/v1/letter-classifications', { code: 'TU.01', name: 'Tata Usaha' }, adminToken),
    );
    expect(created.data.id).toBeGreaterThan(0);

    const duplicate = await post(
      '/api/v1/letter-classifications',
      { code: 'TU.01', name: 'Duplikat' },
      adminToken,
    );
    expect(duplicate.status).toBe(422);

    const list = await json(await request('/api/v1/letter-classifications', {}, adminToken));
    expect(Array.isArray(list.data)).toBe(true);
    expect(list.data.length).toBeGreaterThan(0);
  });
});

describe('guard arsitektur — disposisi', () => {
  it('service tidak berisi SQL mentah', () => {
    const source = readFileSync(
      new URL('../api/modules/dispositions/service/index.ts', import.meta.url),
      'utf8',
    );
    expect(source).not.toMatch(/\b(SELECT|INSERT|UPDATE|DELETE|CREATE TABLE|PRAGMA)\b/);
  });
});
