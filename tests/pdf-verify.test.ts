import { beforeAll, describe, expect, it } from 'bun:test';
import { app } from '../api/app';
import { getMySql } from '../api/db/mysql';
import { makeVerifyCode } from '../api/shared/verify';
import { assertTestDatabase, describeDb } from './helpers/db';

/**
 * Fase 13: generator PDF + verifikasi QR.
 *
 * PDF dibuat dari data surat, diunggah ke MinIO lewat documents, dan memuat QR
 * yang menunjuk ke endpoint verifikasi publik (kode bertanda tangan HMAC).
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

describeDb('PDF dan verifikasi QR', () => {
  let adminToken = '';
  let pegawaiToken = '';
  let assignmentId = 0;

  beforeAll(async () => {
    assertTestDatabase();
    const db = getMySql();
    await db.query('DELETE FROM users');

    await post('/api/v1/users/register', { username: 'admin.pdf', password: 'password123', name: 'Admin PDF' });
    await post('/api/v1/users/register', { username: 'pegawai.pdf', password: 'password123', name: 'Pegawai PDF' });
    await db.query(
      `UPDATE users SET role='admin', is_admin=1, nip='198001012006011060', employment_type='pns', tmt_date='2006-01-01' WHERE username='admin.pdf'`,
    );
    await db.query(
      `UPDATE users SET role='pegawai', is_admin=0, nip='199201012015011061', employment_type='pns', tmt_date='2015-01-01' WHERE username='pegawai.pdf'`,
    );

    adminToken = (
      await json(await post('/api/v1/users/login', { username: 'admin.pdf', password: 'password123' }))
    ).data.token;
    pegawaiToken = (
      await json(await post('/api/v1/users/login', { username: 'pegawai.pdf', password: 'password123' }))
    ).data.token;
  });

  it('menghasilkan PDF surat tugas yang disetujui dan bisa diverifikasi', async () => {
    const created = await json(
      await post(
        '/api/v1/assignment-letters',
        { code: 'ST-PDF', content: 'Tugas uji PDF', place: 'Sleman', start_date: '2035-06-01', end_date: '2035-06-02' },
        pegawaiToken,
      ),
    );
    assignmentId = created.data.id;
    await post(`/api/v1/assignment-letters/${assignmentId}/members`, { name: 'Anggota PDF' }, pegawaiToken);
    await post(`/api/v1/assignment-letters/${assignmentId}/approve`, { decision: 'accepted' }, adminToken);
    await post(`/api/v1/assignment-letters/${assignmentId}/number`, { letter_number: '900' }, adminToken);

    const pdf = await json(
      await request(`/api/v1/assignment-letters/${assignmentId}/pdf`, { method: 'POST' }, adminToken),
    );
    expect(pdf.data.document_id).toBeGreaterThan(0);
    expect(typeof pdf.data.url).toBe('string');
    expect(pdf.data.verify_url).toContain('/verify/');

    const code = makeVerifyCode('assignment_letters', assignmentId);
    const verify = await json(await request(`/verify/${code}`));
    expect(verify.data.valid).toBe(true);
    expect(verify.data.document).toBe('Surat Tugas');
  });

  it('menolak kode verifikasi palsu (404)', async () => {
    const response = await request('/verify/tidak-valid.salah');
    expect(response.status).toBe(404);
  });

  it('menyajikan gambar QR PNG untuk tampilan cetak HTML', async () => {
    const code = makeVerifyCode('assignment_letters', assignmentId);
    const response = await request(`/verify/${code}/qr`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(bytes.length).toBeGreaterThan(100);
  });

  it('menolak cetak PDF surat tugas oleh pegawai (403)', async () => {
    const denied = await request(`/api/v1/assignment-letters/${assignmentId}/pdf`, { method: 'POST' }, pegawaiToken);
    expect(denied.status).toBe(403);
  });

  it('menghasilkan PDF layanan kepegawaian dan mencatat surat', async () => {
    const created = await json(
      await post(
        '/api/v1/service-requests',
        { service_type: 'pensiun', title: 'PDF pensiun', fields: { tempat_lahir: 'Sleman' } },
        pegawaiToken,
      ),
    );
    const id = created.data.id;
    await post(`/api/v1/service-requests/${id}/approve`, { decision: 'accepted' }, adminToken);

    const pdf = await json(
      await request(`/api/v1/service-requests/${id}/pdf`, { method: 'POST' }, adminToken),
    );
    expect(pdf.data.document_id).toBeGreaterThan(0);
    expect(pdf.data.letter_id).toBeGreaterThan(0);

    const code = makeVerifyCode('service_requests', id);
    const verify = await json(await request(`/verify/${code}`));
    expect(verify.data.valid).toBe(true);
    expect(verify.data.service_type).toBe('pensiun');
  });
});
