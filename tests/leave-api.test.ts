import { beforeAll, describe, expect, it } from 'bun:test';
import { app } from '../api/app';
import { getMySql } from '../api/db/mysql';
import { assertTestDatabase, describeDb } from './helpers/db';

/**
 * Test alur cuti lewat HTTP.
 *
 * Dua bug nyata dijaga di sini:
 *  1. `mysql2` mengembalikan DATE sebagai objek Date pada zona lokal, sehingga
 *     tahun transaksi menjadi NaN dan permohonan yang menunggu approval TIDAK
 *     terhitung sebagai reserved. Diuji lewat perilaku API, bukan hanya unit.
 *  2. Route approval level memakai segmen parsial `level-{level}` yang terdaftar
 *     di OpenAPI tetapi tidak dikompilasi router Hono — selalu 404.
 */

type Json = Record<string, any>;

const json = async (response: Response): Promise<Json> => (await response.json()) as Json;

const request = (path: string, options: RequestInit = {}, token?: string) => {
  const headers = new Headers(options.headers);
  if (options.body) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return app.request(path, { ...options, headers });
};

const post = (path: string, payload: unknown, token?: string) =>
  request(path, { method: 'POST', body: JSON.stringify(payload) }, token);

describeDb('alur cuti lewat API', () => {
  let token = '';
  let userId = 0;

  beforeAll(async () => {
    assertTestDatabase();
    const db = getMySql();
    await db.query('DELETE FROM users');

    await post('/api/v1/users/register', {
      username: 'alur.cuti',
      password: 'password123',
      name: 'Penguji Alur',
    });
    // Data uji: TMT jauh di masa lalu supaya eligibility tidak mengaburkan tes.
    await db.query(
      `UPDATE users SET role='admin', is_admin=1,
         nip='199001011990011234', employment_type='pns', tmt_date='2015-03-01'
       WHERE username='alur.cuti'`,
    );

    const login = await post('/api/v1/users/login', {
      username: 'alur.cuti',
      password: 'password123',
    });
    const body = await json(login);
    token = body.data.token;
    userId = body.data.user.id;
  });

  it('menghitung permohonan yang menunggu approval sebagai reserved', async () => {
    const created = await post(
      '/api/v1/leave-requests',
      {
        leave_type: 'Cuti Tahunan',
        duration: 3,
        duration_unit: 'day',
        start_date: '2030-06-03',
        end_date: '2030-06-05',
        reason: 'uji reserved',
      },
      token,
    );
    expect(created.status).toBe(200);

    const quota = await json(await request('/api/v1/leave/quota/me?year=2030', {}, token));

    // Regresi: kalau DATE terbaca sebagai Date lokal, angka-angka ini jadi 0.
    expect(quota.data.reserved_days).toBe(3);
    expect(quota.data.reserved_count).toBe(1);
    expect(quota.data.available.n).toBe(quota.data.official.n - 3);
  });

  it('menyajikan tanggal sebagai YYYY-MM-DD, bukan string Date', async () => {
    const list = await json(await request('/api/v1/leave-requests?year=2030', {}, token));
    expect(list.data.items[0].start_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(list.data.items[0].start_date).toBe('2030-06-03');
  });

  it('mengembalikan 404 (bukan 401) untuk path API yang tidak ada', async () => {
    const response = await request('/api/v1/tidak-ada-sama-sekali', {}, token);
    expect(response.status).toBe(404);
  });

  it('menjalankan approval berjenjang admin -> level 1 -> level 2', async () => {
    const created = await json(
      await post(
        '/api/v1/leave-requests',
        {
          leave_type: 'Cuti Tahunan',
          duration: 2,
          duration_unit: 'day',
          start_date: '2031-01-06',
          end_date: '2031-01-07',
        },
        token,
      ),
    );
    const id = created.data.id;

    // Level 2 sebelum level 1 harus ditolak.
    const premature = await post(`/api/v1/leave-requests/${id}/approve/level/2`, { decision: 'accepted' }, token);
    expect(premature.status).toBe(422);

    // Regresi: path ini pernah selalu 404 karena segmen `level-{level}`.
    const admin = await post(`/api/v1/leave-requests/${id}/approve/admin`, { decision: 'accepted' }, token);
    expect(admin.status).toBe(200);

    const level1 = await post(`/api/v1/leave-requests/${id}/approve/level/1`, { decision: 'accepted' }, token);
    expect(level1.status).toBe(200);
    expect((await json(level1)).data.status).toBe('in_review');

    const level2 = await post(`/api/v1/leave-requests/${id}/approve/level/2`, { decision: 'accepted' }, token);
    expect(level2.status).toBe(200);

    // Setelah final: reserved habis, dan 2 hari terpakai dari jatah tahunan.
    // `official` dari API adalah SISA per bucket (bukan jatah bruto), jadi
    // available hanya tinggal sama dengan official saat reserved = 0.
    const quota = await json(await request('/api/v1/leave/quota/me?year=2031', {}, token));
    expect(quota.data.reserved_days).toBe(0);
    expect(quota.data.official.n).toBe(10); // 12 hari - 2 hari terpakai
    expect(quota.data.available.n).toBe(quota.data.official.n);
  });

  it('menyimpan projection lewat rebuild dan mengembalikannya', async () => {
    const rebuild = await post('/api/v1/leave/quota/rebuild/me', { year: 2031 }, token);
    expect(rebuild.status).toBe(200);

    const stored = await json(await request('/api/v1/leave/quota/stored/me', {}, token));
    const row = stored.data.find((item: Json) => Number(item.year) === 2031);
    expect(row).toBeDefined();
    expect(row.total_remaining).toBeGreaterThanOrEqual(0);
  });

  it('mendukung filter status jamak (koma-terpisah) dan filter approved', async () => {
    const listPending = await json(await request('/api/v1/leave-requests?status=submitted,in_review', {}, token));
    expect(listPending.data.items).toBeDefined();

    const listApproved = await json(await request('/api/v1/leave-requests?status=approved', {}, token));
    expect(listApproved.data.items).toBeDefined();
    expect(listApproved.data.items.length).toBeGreaterThan(0);
    for (const item of listApproved.data.items) {
      expect(item.status).toBe('approved');
    }
  });

  it('menolak akses tanpa token', async () => {
    const response = await request('/api/v1/leave/quota/me');
    expect(response.status).toBe(401);
  });
});
