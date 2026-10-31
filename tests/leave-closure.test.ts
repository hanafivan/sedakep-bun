import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { app } from '../api/app';
import { getMySql } from '../api/db/mysql';
import { assertTestDatabase, describeDb } from './helpers/db';

/**
 * Periode tutup pengajuan cuti tahunan.
 *
 * Penutupan hanya berlaku untuk Cuti Tahunan dan hanya kalau hari ini berada di
 * dalam periode (lihat `isAnnualLeaveClosed`). Periode uji dibuat mengelilingi
 * hari ini, lalu dihapus lagi supaya tidak menutup pengajuan di test lain.
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

/** Tanggal lokal YYYY-MM-DD agar cocok dengan pembacaan server. */
const localIso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const today = new Date();
const dayMs = 24 * 60 * 60 * 1000;
const shift = (days: number) => new Date(today.getTime() + days * dayMs);

describeDb('periode tutup cuti tahunan', () => {
  let adminToken = '';
  let pegawaiToken = '';
  let periodId = 0;

  const year = today.getFullYear();
  const closureStart = localIso(shift(-5));
  const closureEnd = localIso(shift(30));
  const leaveStart = localIso(shift(2));
  const leaveEnd = localIso(shift(4));

  beforeAll(async () => {
    assertTestDatabase();
    const db = getMySql();
    await db.query('DELETE FROM users');

    await post('/api/v1/users/register', {
      username: 'admin.tutup',
      password: 'password123',
      name: 'Admin Tutup',
    });
    await post('/api/v1/users/register', {
      username: 'pegawai.tutup',
      password: 'password123',
      name: 'Pegawai Tutup',
    });
    await db.query(
      `UPDATE users SET role='admin', is_admin=1,
         nip='198103012008011005', employment_type='pns', tmt_date='2008-03-01'
       WHERE username='admin.tutup'`,
    );
    await db.query(
      `UPDATE users SET role='pegawai', is_admin=0,
         nip='199302012017011006', employment_type='pns', tmt_date='2017-01-01'
       WHERE username='pegawai.tutup'`,
    );

    adminToken = (
      await json(
        await post('/api/v1/users/login', { username: 'admin.tutup', password: 'password123' }),
      )
    ).data.token;
    pegawaiToken = (
      await json(
        await post('/api/v1/users/login', { username: 'pegawai.tutup', password: 'password123' }),
      )
    ).data.token;
  });

  afterAll(async () => {
    if (periodId) {
      try {
        await request(
          `/api/v1/leave/admin/closure-periods/${periodId}`,
          { method: 'DELETE' },
          adminToken,
        );
      } catch {
        // Pembersihan best-effort; kegagalan tidak boleh menutupi hasil test.
      }
    }
  });

  it('menolak pengajuan cuti tahunan di dalam periode aktif', async () => {
    const created = await json(
      await post(
        '/api/v1/leave/admin/closure-periods',
        {
          year,
          start_date: closureStart,
          end_date: closureEnd,
          enabled: true,
          message: 'uji-closure',
        },
        adminToken,
      ),
    );
    periodId = created.data.id;
    expect(periodId).toBeGreaterThan(0);

    const response = await post(
      '/api/v1/leave-requests',
      {
        leave_type: 'Cuti Tahunan',
        duration: 2,
        duration_unit: 'day',
        start_date: leaveStart,
        end_date: leaveEnd,
      },
      pegawaiToken,
    );
    expect(response.status).toBe(422);
  });

  it('meloloskan pengajuan ketika periode dinonaktifkan', async () => {
    await request(
      `/api/v1/leave/admin/closure-periods/${periodId}`,
      { method: 'PATCH', body: JSON.stringify({ enabled: false }) },
      adminToken,
    );

    const response = await post(
      '/api/v1/leave-requests',
      {
        leave_type: 'Cuti Tahunan',
        duration: 1,
        duration_unit: 'day',
        start_date: leaveStart,
        end_date: leaveStart,
      },
      pegawaiToken,
    );
    expect(response.status).toBe(200);
    const body = await json(response);
    expect(body.data.id).toBeGreaterThan(0);
  });
});
