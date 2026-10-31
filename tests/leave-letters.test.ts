import { beforeAll, describe, expect, it } from 'bun:test';
import { app } from '../api/app';
import { getMySql } from '../api/db/mysql';
import { assertTestDatabase, describeDb } from './helpers/db';

/**
 * Penerbitan surat keterangan cuti.
 *
 * Tiga hal yang dijaga:
 *  1. Surat hanya terbit untuk permohonan yang sudah final.
 *  2. Nomor otomatis naik berurutan per jenis per tahun.
 *  3. Penerbitan bersamaan tidak mendapat nomor yang sama
 *     (`LAST_INSERT_ID(expr)` di dalam satu statement).
 *
 * Catatan: penolakan validasi bisnis memakai `badRequest` → HTTP 422.
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

const seqOf = (number: string): number => Number(String(number).split('/')[0]);

describeDb('surat keterangan cuti', () => {
  let adminToken = '';
  let pegawaiToken = '';

  const createRequest = async (start: string): Promise<number> => {
    const response = await post(
      '/api/v1/leave-requests',
      {
        leave_type: 'Cuti Tahunan',
        duration: 1,
        duration_unit: 'day',
        start_date: start,
        end_date: start,
      },
      pegawaiToken,
    );
    const body = await json(response);
    if (!body?.data?.id) throw new Error(`gagal membuat permohonan: ${JSON.stringify(body)}`);
    return body.data.id as number;
  };

  const approveFully = async (id: number): Promise<void> => {
    await post(`/api/v1/leave-requests/${id}/approve/admin`, { decision: 'accepted' }, adminToken);
    await post(`/api/v1/leave-requests/${id}/approve/level/1`, { decision: 'accepted' }, adminToken);
    await post(`/api/v1/leave-requests/${id}/approve/level/2`, { decision: 'accepted' }, adminToken);
  };

  const createApproved = async (start: string): Promise<number> => {
    const id = await createRequest(start);
    await approveFully(id);
    return id;
  };

  beforeAll(async () => {
    assertTestDatabase();
    const db = getMySql();
    await db.query('DELETE FROM users');

    await post('/api/v1/users/register', {
      username: 'admin.surat',
      password: 'password123',
      name: 'Admin Surat',
    });
    await post('/api/v1/users/register', {
      username: 'pegawai.surat',
      password: 'password123',
      name: 'Pegawai Surat',
    });
    await db.query(
      `UPDATE users SET role='admin', is_admin=1,
         nip='198002012007011007', employment_type='pns', tmt_date='2007-02-01'
       WHERE username='admin.surat'`,
    );
    await db.query(
      `UPDATE users SET role='pegawai', is_admin=0,
         nip='199402012018011008', employment_type='pns', tmt_date='2018-01-01'
       WHERE username='pegawai.surat'`,
    );

    adminToken = (
      await json(
        await post('/api/v1/users/login', { username: 'admin.surat', password: 'password123' }),
      )
    ).data.token;
    pegawaiToken = (
      await json(
        await post('/api/v1/users/login', { username: 'pegawai.surat', password: 'password123' }),
      )
    ).data.token;
  });

  it('menolak penerbitan untuk permohonan yang belum final', async () => {
    const id = await createRequest('2045-06-02');

    const response = await post(`/api/v1/leave-requests/${id}/letters`, {}, adminToken);
    expect(response.status).toBe(422);

    const letters = await json(
      await request(`/api/v1/leave-requests/${id}/letters`, {}, adminToken),
    );
    expect(letters.data).toHaveLength(0);
  });

  it('menaikkan nomor otomatis satu per satu', async () => {
    const first = await json(
      await post(`/api/v1/leave-requests/${await createApproved('2046-06-01')}/letters`, {}, adminToken),
    );
    expect(first.data.number).toMatch(/^1\/Kk\.12\.04\/1\/Kp\.08\.2\/\d{2}\/2046$/);

    const second = await json(
      await post(`/api/v1/leave-requests/${await createApproved('2046-06-03')}/letters`, {}, adminToken),
    );
    expect(seqOf(second.data.number)).toBe(seqOf(first.data.number) + 1);
  });

  it('memberi nomor berbeda untuk 8 penerbitan bersamaan', async () => {
    const starts = ['01', '02', '03', '04', '05', '06', '07', '08'].map(
      (day) => `2047-01-${day}`,
    );
    const ids: number[] = [];
    for (const start of starts) ids.push(await createApproved(start));

    const responses = await Promise.all(
      ids.map((id) => post(`/api/v1/leave-requests/${id}/letters`, {}, adminToken)),
    );
    for (const response of responses) expect(response.status).toBe(200);

    const bodies = await Promise.all(responses.map((response) => json(response)));
    const numbers = bodies.map((body) => body.data.number as string);

    for (const number of numbers) expect(number).toMatch(/^\d+\/Kk\.12\.04\/1\/Kp\.08\.2\/\d{2}\/2047$/);
    expect(new Set(numbers).size).toBe(8);
  });

  it('menghasilkan formulir permohonan cuti BKN (form-pdf) untuk pemohon', async () => {
    const id = await createRequest('2048-02-10');
    const response = await post(`/api/v1/leave-requests/${id}/form-pdf`, {}, pegawaiToken);
    expect(response.status).toBe(200);

    const body = await json(response);
    expect(body.success).toBe(true);
    expect(body.data.document_id).toBeGreaterThan(0);
    expect(body.data.url).toContain('sedakep-documents');
  });

  it('menghasilkan SK cuti resmi Kemenag Sleman (pdf) setelah surat diterbitkan', async () => {
    const id = await createApproved('2048-03-01');
    await post(`/api/v1/leave-requests/${id}/letters`, { letter_type: 'suket' }, adminToken);

    // Pegawai pemilik dapat mengunduh SK permohonannya sendiri
    const response = await post(`/api/v1/leave-requests/${id}/pdf`, {}, pegawaiToken);
    expect(response.status).toBe(200);

    const body = await json(response);
    expect(body.success).toBe(true);
    expect(body.data.document_id).toBeGreaterThan(0);
    expect(body.data.verify_url).toContain('/verify/');
  });
});
