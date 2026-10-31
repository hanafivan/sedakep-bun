import { beforeAll, describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { app } from '../api/app';
import { getMySql } from '../api/db/mysql';
import { assertTestDatabase, describeDb } from './helpers/db';

/**
 * Test endpoint cuti yang baru (surat keterangan, admin, kuota lanjutan).
 *
 * Empat bug nyata dijaga di sini — semuanya lolos typecheck dan hanya muncul
 * saat endpoint benar-benar ditembak:
 *  1. `/leave/quota/available` tertangkap oleh `/leave/quota/{user_id}` dan
 *     menjawab 422 "user_id: Invalid input".
 *  2. Rute approval/cancel mengembalikan 404 karena middleware berpola
 *     `{id}` menelan path dan `c.req.valid('param')` tidak mengenali `id`.
 *  3. Pengajuan multipart ditolak 422 karena form field selalu string.
 *  4. Unggahan dokumen gagal 500 "Column 'bucket' cannot be null".
 */

type Json = Record<string, any>;

const json = async (response: Response): Promise<Json> => (await response.json()) as Json;

const request = (path: string, options: RequestInit = {}, token?: string) => {
  const headers = new Headers(options.headers);
  // Content-Type JSON HANYA untuk body string. FormData harus dibiarkan
  // menetapkan sendiri `multipart/form-data; boundary=…` — kalau dipaksa
  // application/json, validator mencoba membaca multipart sebagai JSON dan
  // menjawab 500 "Malformed JSON in request body".
  if (typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return app.request(path, { ...options, headers });
};

const post = (path: string, payload: unknown, token?: string) =>
  request(path, { method: 'POST', body: JSON.stringify(payload) }, token);

const put = (path: string, payload: unknown, token?: string) =>
  request(path, { method: 'PUT', body: JSON.stringify(payload) }, token);

describeDb('endpoint cuti lanjutan', () => {
  let adminToken = '';
  let pegawaiToken = '';
  let pegawaiId = 0;

  beforeAll(async () => {
    assertTestDatabase();
    const db = getMySql();
    await db.query('DELETE FROM users');

    // Pengguna pertama otomatis admin.
    await post('/api/v1/users/register', {
      username: 'admin.lanjut',
      password: 'password123',
      name: 'Admin Lanjut',
    });
    await post('/api/v1/users/register', {
      username: 'pegawai.lanjut',
      password: 'password123',
      name: 'Pegawai Lanjut',
    });
    await db.query(
      `UPDATE users SET role='admin', is_admin=1,
         nip='199001011990011234', employment_type='pns', tmt_date='2015-03-01'
       WHERE username='admin.lanjut'`,
    );
    await db.query(
      `UPDATE users SET role='pegawai', is_admin=0,
         nip='199201012015011002', employment_type='pns', tmt_date='2015-01-01'
       WHERE username='pegawai.lanjut'`,
    );

    adminToken = (
      await json(await post('/api/v1/users/login', { username: 'admin.lanjut', password: 'password123' }))
    ).data.token;
    const pegawaiLogin = await json(
      await post('/api/v1/users/login', { username: 'pegawai.lanjut', password: 'password123' }),
    );
    pegawaiToken = pegawaiLogin.data.token;
    pegawaiId = pegawaiLogin.data.user.id;
  });

  it('melayani /leave/quota/available (bukan 422 dari rute {user_id})', async () => {
    const response = await request('/api/v1/leave/quota/available?year=2032', {}, pegawaiToken);
    expect(response.status).toBe(200);
    const body = await json(response);
    expect(body.data.year).toBe(2032);
    expect(typeof body.data.available.n).toBe('number');
  });

  it('menyajikan jenis cuti beserta aturannya', async () => {
    const body = await json(await request('/api/v1/leave/types/me', {}, pegawaiToken));
    const names = body.data.types.map((t: Json) => t.name);
    expect(names).toContain('Cuti Tahunan');
    expect(names).toContain('Cuti Sakit');
    const tahunan = body.data.types.find((t: Json) => t.name === 'Cuti Tahunan');
    expect(tahunan.consumes_quota).toBe(true);
  });

  it('menolak endpoint admin untuk pegawai (403)', async () => {
    for (const path of ['/api/v1/leave/admin/users', '/api/v1/leave/admin/quota-book']) {
      const response = await request(path, {}, pegawaiToken);
      expect(response.status).toBe(403);
    }
  });

  it('menerima pengajuan multipart (duration sebagai string)', async () => {
    const form = new FormData();
    form.set('leave_type', 'Cuti Tahunan');
    form.set('duration', '2');
    form.set('duration_unit', 'day');
    form.set('start_date', '2032-05-10');
    form.set('end_date', '2032-05-11');
    form.set('file', new File([new Uint8Array([37, 80, 68, 70])], 'lampiran.pdf', {
      type: 'application/pdf',
    }));

    const response = await request(
      '/api/v1/leave-requests',
      { method: 'POST', body: form },
      pegawaiToken,
    );
    expect(response.status).toBe(200);
    const body = await json(response);
    expect(body.data.id).toBeGreaterThan(0);
  });

  it('menolak jenis berkas yang tidak didukung tanpa meninggalkan permohonan', async () => {
    const before = await json(
      await request('/api/v1/leave-requests?leave_type=Cuti%20Sakit', {}, pegawaiToken),
    );

    const form = new FormData();
    form.set('leave_type', 'Cuti Sakit');
    form.set('duration', '1');
    form.set('start_date', '2032-07-01');
    form.set('end_date', '2032-07-01');
    form.set('file', new File([new Uint8Array([1, 2, 3])], 'catatan.txt', { type: 'text/plain' }));

    const response = await request(
      '/api/v1/leave-requests',
      { method: 'POST', body: form },
      pegawaiToken,
    );
    expect(response.status).toBe(422);

    // Cuti Sakit wajib lampiran: permohonan tidak boleh tertinggal tanpa bukti.
    const after = await json(
      await request('/api/v1/leave-requests?leave_type=Cuti%20Sakit', {}, pegawaiToken),
    );
    expect(after.data.total).toBe(before.data.total);
  });

  it('melayani approval admin dan cancel (bukan 404)', async () => {
    const created = await json(
      await post(
        '/api/v1/leave-requests',
        {
          leave_type: 'Cuti Tahunan',
          duration: 1,
          start_date: '2032-09-01',
          end_date: '2032-09-01',
        },
        pegawaiToken,
      ),
    );
    const id = created.data.id;

    const admin = await post(`/api/v1/leave-requests/${id}/approve/admin`, { decision: 'accepted' }, adminToken);
    expect(admin.status).toBe(200);

    const cancel = await post(`/api/v1/leave-requests/${id}/cancel`, { note: 'uji batal' }, adminToken);
    expect(cancel.status).toBe(200);
    expect((await json(cancel)).data.status).toBe('cancelled');
  });

  it('menerbitkan surat keterangan hanya setelah final, dengan nomor urut', async () => {
    const created = await json(
      await post(
        '/api/v1/leave-requests',
        {
          leave_type: 'Cuti Tahunan',
          duration: 1,
          start_date: '2033-02-01',
          end_date: '2033-02-01',
        },
        pegawaiToken,
      ),
    );
    const id = created.data.id;

    const tooEarly = await post(`/api/v1/leave-requests/${id}/letters`, {}, adminToken);
    expect(tooEarly.status).toBe(422);

    await post(`/api/v1/leave-requests/${id}/approve/admin`, { decision: 'accepted' }, adminToken);
    await post(`/api/v1/leave-requests/${id}/approve/level/1`, { decision: 'accepted' }, adminToken);
    await post(`/api/v1/leave-requests/${id}/approve/level/2`, { decision: 'accepted' }, adminToken);

    const first = await json(await post(`/api/v1/leave-requests/${id}/letters`, {}, adminToken));
    expect(first.data.number).toMatch(/^\d+\/Kk\.12\.04\/1\/Kp\.08\.2\/\d{2}\/2033$/);

    const madrasah = await json(
      await post(`/api/v1/leave-requests/${id}/letters`, { letter_type: 'suket_madrasah' }, adminToken),
    );
    expect(madrasah.data.number).toMatch(/^\d+\/Kk\.12\.04\/1\/Kp\.08\.2\/\d{2}\/2033$/);

    const letters = await json(await request(`/api/v1/leave-requests/${id}/letters`, {}, adminToken));
    expect(letters.data).toHaveLength(2);
  });

  it('menyimpan berkas SK pada surat (bucket dokumen tidak null)', async () => {
    const letters = await json(await request('/api/v1/leave/letters?per_page=1', {}, adminToken));
    const letter = letters.data.items[0];
    expect(letter).toBeDefined();

    const form = new FormData();
    form.set('file', new File([new Uint8Array([37, 80, 68, 70, 45, 49])], 'sk.pdf', {
      type: 'application/pdf',
    }));
    const response = await request(
      `/api/v1/leave/letters/${letter.id}/file`,
      { method: 'POST', body: form },
      adminToken,
    );
    expect(response.status).toBe(200);
    expect((await json(response)).data.document_id).toBeGreaterThan(0);
  });

  it('mengelola periode tutup, identitas instansi, penyesuaian, dan buku cuti', async () => {
    const created = await json(
      await post(
        '/api/v1/leave/admin/closure-periods',
        { year: 2033, start_date: '2033-12-20', end_date: '2033-12-31', message: 'uji' },
        adminToken,
      ),
    );
    expect(created.data.id).toBeGreaterThan(0);
    const removed = await request(`/api/v1/leave/admin/closure-periods/${created.data.id}`, { method: 'DELETE' }, adminToken);
    expect(removed.status).toBe(200);

    const instance = await json(
      await put('/api/v1/leave/admin/instance', { name: 'Kantor Uji' }, adminToken),
    );
    expect(instance.data.name).toBe('Kantor Uji');

    const adjustment = await json(
      await post(
        '/api/v1/leave/quota/adjustment',
        { user_id: pegawaiId, year: 2033, days: 3, reason: 'uji' },
        adminToken,
      ),
    );
    expect(adjustment.data.days).toBe(3);
    // 12 jatah − 1 hari terpakai (surat di tahun 2033) + 3 penyesuaian = 14.
    expect(adjustment.data.quota.official.n).toBe(14);

    const book = await json(
      await request(`/api/v1/leave/admin/quota-book?year=2033&search=${pegawaiId}`, {}, adminToken),
    );
    expect(book.data.items.length).toBeGreaterThan(0);
  });

  it('mencatat TMT PPPK lewat pengaturan', async () => {
    const saved = await json(
      await put(
        '/api/v1/leave/admin/pppk-tmt',
        { nip: '199201012015011002', tmt_date: '2015-01-01' },
        adminToken,
      ),
    );
    expect(saved.data.tmt_date).toBe('2015-01-01');

    const summary = await json(await request('/api/v1/leave/admin/pppk-tmt', {}, adminToken));
    expect(summary.data.recorded.length).toBe(1);

    await put('/api/v1/leave/admin/pppk-tmt', { nip: '199201012015011002', tmt_date: null }, adminToken);
    const after = await json(await request('/api/v1/leave/admin/pppk-tmt', {}, adminToken));
    expect(after.data.recorded.length).toBe(0);
  });

  it('arsip statistik mengembalikan rekap per status dan arsip legacy', async () => {
    const body = await json(await request('/api/v1/leave-requests/statistics', {}, adminToken));
    expect(Array.isArray(body.data.by_status)).toBe(true);
    expect(Array.isArray(body.data.by_type)).toBe(true);
    expect(body.data.by_archive).toBeDefined();
    expect(typeof body.data.by_archive.belum_diperiksa).toBe('number');
  });

  it('menyajikan data cetak buku cuti untuk pemiliknya', async () => {
    const response = await request('/api/v1/leave/quota/book/me', {}, pegawaiToken);
    expect(response.status).toBe(200);
    const body = await json(response);
    expect(body.data.user).toBeDefined();
    expect(Array.isArray(body.data.stored)).toBe(true);
  });
});

describe('guard arsitektur — modul lain tidak menumbuhkan SQL', () => {
  it('service dokumen tidak berisi SQL mentah', () => {
    const source = readFileSync(
      new URL('../api/modules/documents/service/index.ts', import.meta.url),
      'utf8',
    );
    expect(source).not.toMatch(/\b(SELECT|INSERT|UPDATE|DELETE)\b/);
  });
});
