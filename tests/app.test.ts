import { beforeEach, describe, expect, it } from 'bun:test';
import { app } from '../api/app';
import { getDb } from '../api/db';

type Body = {
  success: boolean;
  data: any;
  message: string;
  code: number;
  details?: unknown;
};

const postJson = (path: string, payload: unknown) =>
  app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

const readJson = async (response: Response) => (await response.json()) as Body;

describe('API', () => {
  beforeEach(() => {
    getDb().query('DELETE FROM users').run();
  });

  it('returns health status', async () => {
    const response = await app.request('/health');
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('ok');
  });

  it('registers a user with 200 and no data returned', async () => {
    const register = await postJson('/api/v1/users/register', {
      username: 'hanafi',
      password: 'password123',
    });
    const body = await readJson(register);

    expect(register.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      data: null,
      code: 200,
      message: 'User berhasil didaftarkan',
    });
    expect(body.data).not.toHaveProperty('id');
    expect(body.data).not.toHaveProperty('username');
  });

  it('logs in a registered user', async () => {
    await postJson('/api/v1/users/register', {
      username: 'hanafi',
      password: 'password123',
    });

    const login = await postJson('/api/v1/users/login', {
      username: 'hanafi',
      password: 'password123',
    });
    const body = await readJson(login);

    expect(login.status).toBe(200);
    expect(body.data.token).toEqual(expect.any(String));
  });

  it('rejects duplicate username', async () => {
    const payload = { username: 'hanafi', password: 'password123' };
    await postJson('/api/v1/users/register', payload);

    const response = await postJson('/api/v1/users/register', payload);
    const body = await readJson(response);

    expect(response.status).toBe(409);
    expect(body.success).toBe(false);
  });

  it('rejects wrong password', async () => {
    await postJson('/api/v1/users/register', {
      username: 'hanafi',
      password: 'password123',
    });

    const response = await postJson('/api/v1/users/login', {
      username: 'hanafi',
      password: 'salah-sekali',
    });

    expect(response.status).toBe(401);
  });

  it('rejects invalid input with 422 and field details', async () => {
    const response = await postJson('/api/v1/users/register', {
      username: 'a',
      password: 'b',
    });
    const body = await readJson(response);

    expect(response.status).toBe(422);
    expect(body.success).toBe(false);
    expect(body.details).toMatchObject({
      username: expect.any(Array),
      password: expect.any(Array),
    });
  });

  it('returns 404 for unknown endpoint', async () => {
    const response = await app.request('/tidak-ada');
    expect(response.status).toBe(404);
  });
});
