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
      '/api/v1/agendas',
      '/api/v1/agendas/{id}',
      '/api/v1/agendas/{id}/file',
      '/api/v1/agendas/{id}/report',
      '/api/v1/alibi-requests',
      '/api/v1/alibi-requests/{id}',
      '/api/v1/alibi-requests/{id}/approve/admin',
      '/api/v1/alibi-requests/{id}/approve/level/{level}',
      '/api/v1/alibi-requests/{id}/cancel',
      '/api/v1/alibi-requests/{id}/file',
      '/api/v1/assignment-letters',
      '/api/v1/assignment-letters/{id}',
      '/api/v1/assignment-letters/{id}/approve',
      '/api/v1/assignment-letters/{id}/cancel',
      '/api/v1/assignment-letters/{id}/copies',
      '/api/v1/assignment-letters/{id}/copies/{copyId}',
      '/api/v1/assignment-letters/{id}/file',
      '/api/v1/assignment-letters/{id}/members',
      '/api/v1/assignment-letters/{id}/members/{memberId}',
      '/api/v1/assignment-letters/{id}/notes',
      '/api/v1/assignment-letters/{id}/notes/{noteId}',
      '/api/v1/assignment-letters/{id}/number',
      '/api/v1/assignment-letters/{id}/pdf',
      '/api/v1/documents',
      '/api/v1/documents/unlinked',
      '/api/v1/documents/{id}',
      '/api/v1/documents/{id}/download',
      '/api/v1/incoming-letters',
      '/api/v1/incoming-letters/{id}',
      '/api/v1/incoming-letters/{id}/dispositions',
      '/api/v1/incoming-letters/{id}/dispositions/{childId}',
      '/api/v1/incoming-letters/{id}/file',
      '/api/v1/incoming-letters/{id}/finalize',
      '/api/v1/incoming-letters/{id}/finals',
      '/api/v1/incoming-letters/{id}/finals/{childId}',
      '/api/v1/incoming-letters/{id}/references',
      '/api/v1/incoming-letters/{id}/references/{childId}',
      '/api/v1/leave-requests',
      '/api/v1/leave-requests/statistics',
      '/api/v1/leave-requests/{id}',
      '/api/v1/leave-requests/{id}/approve/admin',
      '/api/v1/leave-requests/{id}/approve/level/{level}',
      '/api/v1/leave-requests/{id}/cancel',
      '/api/v1/leave-requests/{id}/form-pdf',
      '/api/v1/leave-requests/{id}/letters',
      '/api/v1/leave-requests/{id}/letters/{letter_type}',
      '/api/v1/leave-requests/{id}/pdf',
      '/api/v1/leave/admin/closure-periods',
      '/api/v1/leave/admin/closure-periods/{id}',
      '/api/v1/leave/admin/export',
      '/api/v1/leave/admin/instance',
      '/api/v1/leave/admin/pppk-tmt',
      '/api/v1/leave/admin/quota-audit',
      '/api/v1/leave/admin/quota-book',
      '/api/v1/leave/admin/users',
      '/api/v1/leave/admin/yearly-summary',
      '/api/v1/leave/approvals/summary',
      '/api/v1/leave/approvers',
      '/api/v1/leave/legacy-history',
      '/api/v1/leave/letters',
      '/api/v1/leave/letters/{id}/file',
      '/api/v1/leave/policy',
      '/api/v1/leave/quota/adjustment',
      '/api/v1/leave/quota/adjustment/{id}',
      '/api/v1/leave/quota/adjustment/{user_id}',
      '/api/v1/leave/quota/available',
      '/api/v1/leave/quota/book/{user_id}',
      '/api/v1/leave/quota/eligibility-override',
      '/api/v1/leave/quota/history/{user_id}',
      '/api/v1/leave/quota/rebuild/{user_id}',
      '/api/v1/leave/quota/rollover',
      '/api/v1/leave/quota/stored/{user_id}',
      '/api/v1/leave/quota/{user_id}',
      '/api/v1/leave/types/{user_id}',
      '/api/v1/letter-classifications',
      '/api/v1/letter-classifications/{id}',
      '/api/v1/navigation/badges',
      '/api/v1/organizations',
      '/api/v1/organizations/{id}',
      '/api/v1/positions',
      '/api/v1/positions/{id}',
      '/api/v1/service-requests',
      '/api/v1/service-requests/meta',
      '/api/v1/service-requests/{id}',
      '/api/v1/service-requests/{id}/approve',
      '/api/v1/service-requests/{id}/checks',
      '/api/v1/service-requests/{id}/documents',
      '/api/v1/service-requests/{id}/fields',
      '/api/v1/service-requests/{id}/letters',
      '/api/v1/service-requests/{id}/pdf',
      '/api/v1/settings',
      '/api/v1/settings/{key}',
      '/api/v1/system/backups',
      '/api/v1/system/backups/restore',
      '/api/v1/users',
      '/api/v1/users/login',
      '/api/v1/users/me',
      '/api/v1/users/me/password',
      '/api/v1/users/register',
      '/api/v1/users/{id}',
      '/api/v1/users/{id}/reset-password',
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

  it('menampilkan multipart upload dokumen dengan file binary', async () => {
    const spec = await json(await app.request('/openapi.json'));
    const uploadRoute = spec.paths['/api/v1/documents'].post;
    const schema = uploadRoute.requestBody.content['multipart/form-data'].schema;
    expect(schema.properties.file.type).toBe('string');
    expect(schema.properties.file.format).toBe('binary');
  });

  it('mengembalikan 404 JSON untuk path API yang tidak ada', async () => {
    const response = await app.request('/api/v1/tidak-ada');
    const body = await json(response);

    expect(response.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.data).toBeNull();
  });
});
