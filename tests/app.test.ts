import { beforeEach, describe, expect, it } from 'bun:test';
import { app } from '../api/app';
import { getMySql } from '../api/db/mysql';
import { assertTestDatabase, describeDb } from './helpers/db';

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

describeDb('API', () => {
  beforeEach(async () => {
    assertTestDatabase();
    await getMySql().query('DELETE FROM users');
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
      name: 'Hanafi',
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
      name: 'Hanafi',
    });

    const login = await postJson('/api/v1/users/login', {
      username: 'hanafi',
      password: 'password123',
    });
    const body = await readJson(login);

    expect(login.status).toBe(200);
    expect(body.data.token).toEqual(expect.any(String));
    expect(body.data.user.password_hash).toBeUndefined();
    expect(body.data.user.name).toBe('Hanafi');
  });

  it('rejects duplicate username', async () => {
    const payload = { username: 'hanafi', password: 'password123', name: 'Hanafi' };
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
      name: 'Hanafi',
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

  it('serves /me and /api/v1/me for authenticated user', async () => {
    await postJson('/api/v1/users/register', {
      username: 'hanafi',
      password: 'password123',
      name: 'Hanafi',
    });
    const login = await postJson('/api/v1/users/login', {
      username: 'hanafi',
      password: 'password123',
    });
    const { data: { token } } = await readJson(login);

    const resRootMe = await app.request('/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(resRootMe.status).toBe(200);
    const bodyRootMe = await readJson(resRootMe);
    expect(bodyRootMe.success).toBe(true);
    expect(bodyRootMe.data.username).toBe('hanafi');

    const resApiMe = await app.request('/api/v1/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(resApiMe.status).toBe(200);
    const bodyApiMe = await readJson(resApiMe);
    expect(bodyApiMe.success).toBe(true);
    expect(bodyApiMe.data.username).toBe('hanafi');
  });

  it('serves /badges and /api/v1/badges for authenticated user', async () => {
    await postJson('/api/v1/users/register', {
      username: 'hanafi',
      password: 'password123',
      name: 'Hanafi',
    });
    const login = await postJson('/api/v1/users/login', {
      username: 'hanafi',
      password: 'password123',
    });
    const { data: { token } } = await readJson(login);

    const resRootBadges = await app.request('/badges', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(resRootBadges.status).toBe(200);
    const bodyRootBadges = await readJson(resRootBadges);
    expect(bodyRootBadges.success).toBe(true);
    expect(bodyRootBadges.data).toHaveProperty('leave_quota_remaining');
    expect(bodyRootBadges.data).toHaveProperty('leave_pending_approval');

    const resApiBadges = await app.request('/api/v1/badges', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(resApiBadges.status).toBe(200);
    const bodyApiBadges = await readJson(resApiBadges);
    expect(bodyApiBadges.success).toBe(true);
    expect(bodyApiBadges.data).toHaveProperty('leave_quota_remaining');
  });
});
