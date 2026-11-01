import { describe, expect, it, spyOn } from 'bun:test';
import { sign } from 'hono/jwt';
import { app } from '../api/app';
import { config } from '../api/config';
import * as domain from '../api/modules/documents/domain';

const makeToken = async (role = 'pegawai') => {
  return sign(
    {
      sub: '1',
      username: 'test.user',
      role,
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    config.jwt.secret,
    config.jwt.algorithm,
  );
};

describe('endpoint dokumen (/api/v1/documents)', () => {
  it('menolak akses tanpa token di semua endpoint /documents (401)', async () => {
    expect((await app.request('/api/v1/documents')).status).toBe(401);
    expect((await app.request('/api/v1/documents/unlinked')).status).toBe(401);
    expect((await app.request('/api/v1/documents/1/download')).status).toBe(401);
    expect((await app.request('/api/v1/documents/1', { method: 'DELETE' })).status).toBe(401);
    expect((await app.request('/api/v1/documents', { method: 'POST' })).status).toBe(401);
  });

  it('memastikan path di luar /documents tetap mengembalikan 404 (bukan 401)', async () => {
    const res = await app.request('/api/v1/path-yang-benar-benar-tidak-ada');
    expect(res.status).toBe(404);
  });

  it('mengembalikan 422 jika file tidak diunggah', async () => {
    const token = await makeToken();
    const form = new FormData();
    form.append('entity_table', 'users');
    form.append('entity_id', '1');

    const res = await app.request('/api/v1/documents', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: form,
    });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.code).toBe(422);
    expect(body.details.file).toBeDefined();
  });

  it('mengembalikan 422 jika entity_id bukan angka positif', async () => {
    const token = await makeToken();
    const form = new FormData();
    const file = new File(['content'], 'test.txt', { type: 'text/plain' });
    form.append('file', file);
    form.append('entity_table', 'users');
    form.append('entity_id', '-5');

    const res = await app.request('/api/v1/documents', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: form,
    });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.code).toBe(422);
    expect(body.details.entity_id).toBeDefined();
  });

  it('mengembalikan 422 jika entity_table kosong', async () => {
    const token = await makeToken();
    const form = new FormData();
    const file = new File(['content'], 'test.txt', { type: 'text/plain' });
    form.append('file', file);
    form.append('entity_table', '   ');
    form.append('entity_id', '1');

    const res = await app.request('/api/v1/documents', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: form,
    });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.code).toBe(422);
    expect(body.details.entity_table).toBeDefined();
  });

  it('berhasil upload jika seluruh form valid', async () => {
    const token = await makeToken();
    const form = new FormData();
    const file = new File(['dummy-content'], 'surat.pdf', { type: 'application/pdf' });
    form.append('file', file);
    form.append('entity_table', 'leave_requests');
    form.append('entity_id', '42');

    // Mock domain.uploadDocument
    const spy = spyOn(domain, 'uploadDocument').mockImplementation(async (params: any) => ({
      id: 999,
      object_key: 'documents/surat.pdf',
      original_filename: params.filename,
      size_bytes: params.buffer.length,
      sha256: 'mock-sha256',
    }));

    try {
      const res = await app.request('/api/v1/documents', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: form,
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(999);
      expect(body.data.original_filename).toBe('surat.pdf');
    } finally {
      spy.mockRestore();
    }
  });

  it('memastikan spesifikasi OpenAPI dokumen memiliki method, tags, security, dan path yang identik', async () => {
    const res = await app.request('/openapi.json');
    const spec = await res.json();

    // 1. /api/v1/documents GET & POST
    expect(spec.paths['/api/v1/documents'].get.tags).toEqual(['Documents']);
    expect(spec.paths['/api/v1/documents'].get.security).toEqual([{ bearerAuth: [] }]);
    expect(spec.paths['/api/v1/documents'].post.tags).toEqual(['Documents']);
    expect(spec.paths['/api/v1/documents'].post.security).toEqual([{ bearerAuth: [] }]);

    // 2. /api/v1/documents/unlinked GET
    expect(spec.paths['/api/v1/documents/unlinked'].get.tags).toEqual(['Documents']);
    expect(spec.paths['/api/v1/documents/unlinked'].get.security).toEqual([{ bearerAuth: [] }]);

    // 3. /api/v1/documents/{id}/download GET
    expect(spec.paths['/api/v1/documents/{id}/download'].get.tags).toEqual(['Documents']);
    expect(spec.paths['/api/v1/documents/{id}/download'].get.security).toEqual([{ bearerAuth: [] }]);

    // 4. /api/v1/documents/{id} DELETE
    expect(spec.paths['/api/v1/documents/{id}'].delete.tags).toEqual(['Documents']);
    expect(spec.paths['/api/v1/documents/{id}'].delete.security).toEqual([{ bearerAuth: [] }]);
  });
});
