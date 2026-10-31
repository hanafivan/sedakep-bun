import { beforeAll, describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { app } from '../api/app';
import { getMySql } from '../api/db/mysql';
import { assertTestDatabase, describeDb } from './helpers/db';

/** Modul agenda lewat HTTP: CRUD, input laporan, berkas, dan scoping. */

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

describeDb('agenda lewat API', () => {
  let pegawaiToken = '';
  let pegawai2Token = '';
  let agendaId = 0;

  beforeAll(async () => {
    assertTestDatabase();
    const db = getMySql();
    await db.query('DELETE FROM users');

    await post('/api/v1/users/register', {
      username: 'admin.agenda',
      password: 'password123',
      name: 'Admin Agenda',
    });
    await post('/api/v1/users/register', {
      username: 'pegawai.agenda1',
      password: 'password123',
      name: 'Pegawai Agenda Satu',
    });
    await post('/api/v1/users/register', {
      username: 'pegawai.agenda2',
      password: 'password123',
      name: 'Pegawai Agenda Dua',
    });
    await db.query(
      `UPDATE users SET role='pegawai', is_admin=0,
         nip='199201012015011041', employment_type='pns', tmt_date='2015-01-01'
       WHERE username='pegawai.agenda1'`,
    );
    await db.query(
      `UPDATE users SET role='pegawai', is_admin=0,
         nip='199301012016011042', employment_type='pns', tmt_date='2016-01-01'
       WHERE username='pegawai.agenda2'`,
    );

    pegawaiToken = (
      await json(
        await post('/api/v1/users/login', { username: 'pegawai.agenda1', password: 'password123' }),
      )
    ).data.token;
    pegawai2Token = (
      await json(
        await post('/api/v1/users/login', { username: 'pegawai.agenda2', password: 'password123' }),
      )
    ).data.token;
  });

  it('membuat agenda dengan snapshot nama/NIP', async () => {
    const created = await json(
      await post(
        '/api/v1/agendas',
        { title: 'Rapat koordinasi', place: 'Aula', start_at: '2035-05-01T08:00', end_at: '2035-05-01T10:00' },
        pegawaiToken,
      ),
    );
    agendaId = created.data.id;
    expect(agendaId).toBeGreaterThan(0);

    const detail = await json(await request(`/api/v1/agendas/${agendaId}`, {}, pegawaiToken));
    expect(detail.data.title).toBe('Rapat koordinasi');
    expect(detail.data.nip).toBe('199201012015011041');
    expect(String(detail.data.start_at)).toContain('2035-05-01 08:00');
  });

  it('mengubah judul agenda', async () => {
    const updated = await patch(`/api/v1/agendas/${agendaId}`, { title: 'Rapat koordinasi (revisi)' }, pegawaiToken);
    expect(updated.status).toBe(200);
    const detail = await json(await request(`/api/v1/agendas/${agendaId}`, {}, pegawaiToken));
    expect(detail.data.title).toBe('Rapat koordinasi (revisi)');
  });

  it('mengisi laporan agenda', async () => {
    const result = await json(
      await post(`/api/v1/agendas/${agendaId}/report`, { report: 'Laporan hasil rapat' }, pegawaiToken),
    );
    expect(result.data.id).toBe(agendaId);
    const detail = await json(await request(`/api/v1/agendas/${agendaId}`, {}, pegawaiToken));
    expect(detail.data.report).toBe('Laporan hasil rapat');
    expect(detail.data.reported_at).not.toBeNull();
  });

  it('mengunggah berkas laporan', async () => {
    const form = new FormData();
    form.set('file', new File([new Uint8Array([37, 80, 68, 70])], 'laporan.pdf', {
      type: 'application/pdf',
    }));
    const uploaded = await json(
      await request(`/api/v1/agendas/${agendaId}/file`, { method: 'POST', body: form }, pegawaiToken),
    );
    expect(uploaded.data.document_id).toBeGreaterThan(0);
  });

  it('pegawai lain tidak dapat melihat agenda bukan miliknya', async () => {
    const view = await request(`/api/v1/agendas/${agendaId}`, {}, pegawai2Token);
    expect(view.status).toBe(422);
    const list = await json(await request('/api/v1/agendas', {}, pegawai2Token));
    expect(list.data.total).toBe(0);
  });
});

describe('guard arsitektur — agenda', () => {
  it('service tidak berisi SQL mentah', () => {
    const source = readFileSync(
      new URL('../api/modules/agendas/service/index.ts', import.meta.url),
      'utf8',
    );
    expect(source).not.toMatch(/\b(SELECT|INSERT|UPDATE|DELETE|CREATE TABLE|PRAGMA)\b/);
  });
});
