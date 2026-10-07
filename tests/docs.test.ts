import { describe, expect, it } from 'bun:test';
import { app } from '../api/app';

type JsonObject = Record<string, any>;

const json = async (response: Response): Promise<JsonObject> =>
  await response.json() as JsonObject;

describe('dokumentasi OpenAPI', () => {
  it('menyajikan /openapi.json dengan semua path API', async () => {
    const response = await app.request('/openapi.json');
    const spec = await json(response);

    expect(response.status).toBe(200);
    expect(spec.openapi).toBe('3.0.0');
    expect(Object.keys(spec.paths).sort()).toEqual([
      '/api/v1/admin/status',
      '/api/v1/users/login',
      '/api/v1/users/me',
      '/api/v1/users/register',
    ]);
  });

  it('mendaftarkan security scheme bearer dan basic', async () => {
    const spec = await json(await app.request('/openapi.json'));

    expect(spec.components.securitySchemes.bearerAuth.scheme).toBe('bearer');
    expect(spec.components.securitySchemes.basicAuth.scheme).toBe('basic');
  });

  it('menandai /users/me butuh bearer auth', async () => {
    const spec = await json(await app.request('/openapi.json'));

    expect(spec.paths['/api/v1/users/me'].get.security).toEqual([{ bearerAuth: [] }]);
  });

  it('menyajikan Swagger UI di /docs', async () => {
    const response = await app.request('/docs');

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('swagger');
  });

  it('mengembalikan 404 JSON untuk path API yang tidak ada', async () => {
    const response = await app.request('/api/v1/tidak-ada');
    const body = await json(response);

    expect(response.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.data).toBeNull();
  });
});
