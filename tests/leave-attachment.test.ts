import { beforeAll, describe, expect, it } from 'bun:test';
import { app } from '../api/app';
import { getMySql } from '../api/db/mysql';
import { assertTestDatabase, describeDb } from './helpers/db';

/**
 * Lampiran wajib pada jenis cuti tertentu.
 *
 * `Cuti Sakit` wajib surat keterangan dokter. Tanpa berkas permohonan harus
 * ditolak dan TIDAK boleh meninggalkan baris `leave_requests`; pengajuan tanpa
 * bukti adalah data rusak yang tidak bisa dipakai atasan.
 *
 * Catatan: penolakan validasi bisnis memakai `badRequest` → HTTP 422
 * (bukan 400 seperti tertulis di draft plan).
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

const countSick = async (token: string): Promise<number> => {
  const body = await json(
    await request('/api/v1/leave-requests?leave_type=Cuti%20Sakit', {}, token),
  );
  return body.data.total as number;
};

describeDb('lampiran permohonan cuti', () => {
  let pegawaiToken = '';

  beforeAll(async () => {
    assertTestDatabase();
    const db = getMySql();
    await db.query('DELETE FROM users');

    // Pengguna pertama otomatis admin — tidak dipakai di sini, hanya agar
    // pegawai berikutnya mendapat role default.
    await post('/api/v1/users/register', {
      username: 'admin.lampiran',
      password: 'password123',
      name: 'Admin Lampiran',
    });
    await post('/api/v1/users/register', {
      username: 'pegawai.lampiran',
      password: 'password123',
      name: 'Pegawai Lampiran',
    });
    await db.query(
      `UPDATE users SET role='admin', is_admin=1,
         nip='198302012009011003', employment_type='pns', tmt_date='2009-02-01'
       WHERE username='admin.lampiran'`,
    );
    await db.query(
      `UPDATE users SET role='pegawai', is_admin=0,
         nip='199202012016011004', employment_type='pns', tmt_date='2016-01-01'
       WHERE username='pegawai.lampiran'`,
    );

    pegawaiToken = (
      await json(
        await post('/api/v1/users/login', {
          username: 'pegawai.lampiran',
          password: 'password123',
        }),
      )
    ).data.token;
  });

  it('menolak Cuti Sakit tanpa berkas dan tidak menyisakan permohonan', async () => {
    const before = await countSick(pegawaiToken);

    const response = await post(
      '/api/v1/leave-requests',
      {
        leave_type: 'Cuti Sakit',
        duration: 1,
        duration_unit: 'day',
        start_date: '2044-03-01',
        end_date: '2044-03-01',
      },
      pegawaiToken,
    );
    expect(response.status).toBe(422);

    const after = await countSick(pegawaiToken);
    expect(after).toBe(before);
  });

  it('menerima Cuti Sakit dengan berkas dan mengisi attachment_id', async () => {
    const form = new FormData();
    form.set('leave_type', 'Cuti Sakit');
    form.set('duration', '1');
    form.set('duration_unit', 'day');
    form.set('start_date', '2044-03-02');
    form.set('end_date', '2044-03-02');
    form.set('reason', 'uji lampiran');
    form.set(
      'file',
      new File([new Uint8Array([37, 80, 68, 70])], 'surat-dokter.pdf', {
        type: 'application/pdf',
      }),
    );

    const response = await request(
      '/api/v1/leave-requests',
      { method: 'POST', body: form },
      pegawaiToken,
    );
    expect(response.status).toBe(200);

    const body = await json(response);
    expect(body.data.id).toBeGreaterThan(0);
    expect(body.data.attachment_id).toBeGreaterThan(0);
  });
});
