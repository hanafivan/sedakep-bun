import { beforeEach, describe, expect, it } from 'bun:test';
import { app } from '../api/app';
import { getDb } from '../api/db';

type Body = { success: boolean; data: any; message: string; code: number };

const readJson = async (response: Response) => (await response.json()) as Body;

const basicHeader = (username: string, password: string) => ({
  Authorization: `Basic ${btoa(`${username}:${password}`)}`,
});

const postJson = (path: string, payload: unknown, headers: Record<string, string> = {}) =>
  app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  });

const registerUser = (username = 'hanafi', password = 'password123') =>
  postJson('/api/v1/users/register', { username, password });

const loginUser = async (username = 'hanafi', password = 'password123') => {
  const response = await postJson('/api/v1/users/login', { username, password });
  const body = await readJson(response);
  return body.data?.token as string;
};

describe('basic auth middleware', () => {
  it('menolak request tanpa header Authorization', async () => {
    const response = await app.request('/api/v1/admin/status');
    const body = await readJson(response);

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it('menolak kredensial yang salah', async () => {
    const response = await app.request('/api/v1/admin/status', {
      headers: basicHeader('admin', 'password-salah'),
    });

    expect(response.status).toBe(401);
  });

  it('menolak header yang bukan Basic', async () => {
    const response = await app.request('/api/v1/admin/status', {
      headers: { Authorization: 'Bearer sesuatu' },
    });

    expect(response.status).toBe(401);
  });

  it('meloloskan kredensial yang benar', async () => {
    const response = await app.request('/api/v1/admin/status', {
      headers: basicHeader('admin', 'admin'),
    });
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('operational');
  });
});

describe('bearer auth middleware', () => {
  beforeEach(() => {
    getDb().query('DELETE FROM users').run();
  });

  it('menolak request tanpa token', async () => {
    const response = await app.request('/api/v1/users/me');
    const body = await readJson(response);

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it('menolak token yang tidak valid', async () => {
    const response = await app.request('/api/v1/users/me', {
      headers: { Authorization: 'Bearer token-palsu' },
    });

    expect(response.status).toBe(401);
  });

  it('mengembalikan user dari token yang valid', async () => {
    await registerUser();
    const token = await loginUser();

    const response = await app.request('/api/v1/users/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.data.username).toBe('hanafi');
    expect(body.data.password).toBeUndefined();
  });
});
