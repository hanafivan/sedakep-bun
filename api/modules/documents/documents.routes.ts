import { OpenAPIHono } from '@hono/zod-openapi';
import { bearerAuth } from '../../middleware/bearerAuth';
import { defaultHook } from '../../shared/openapi-hook';
import { badRequest } from '../../shared/errors';
import { successBody } from '../../shared/response';
import {
  deleteDocumentRoute,
  downloadDocumentRoute,
  listEntityDocumentsRoute,
  orphanDocumentsRoute,
  uploadDocumentRoute,
} from './schema';
import * as service from './service';

/** Route dokumen — semua endpoint wajib login. */

export const documentRoutes = new OpenAPIHono({ defaultHook });

// Scope ke /documents saja. Kalau pakai '*', route ini menelan seluruh
// /api/v1 dan mengubah 404 menjadi 401 untuk path yang tidak ada.
documentRoutes.use('/documents', bearerAuth);
documentRoutes.use('/documents/*', bearerAuth);

documentRoutes.openapi(listEntityDocumentsRoute, async (c) => {
  const query = c.req.valid('query');
  const documents = await service.listByEntity(query.entity_table, query.entity_id);
  return c.json(successBody(documents, 'Daftar dokumen entitas'), 200);
});

documentRoutes.openapi(orphanDocumentsRoute, async (c) => {
  const documents = await service.listUnlinked();
  return c.json(successBody(documents, 'Dokumen belum tertaut'), 200);
});

documentRoutes.openapi(uploadDocumentRoute, async (c) => {
  const form = await c.req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) throw badRequest('Berkas wajib diunggah pada kolom "file"');

  const entityTable = String(form.get('entity_table') ?? '').trim();
  const entityId = Number(form.get('entity_id'));
  if (!entityTable
    || !Number.isInteger(entityId)
    || entityId <= 0) {
    throw badRequest('entity_table dan entity_id wajib valid');
  }

  const actor = c.get('user');
  const result = await service.uploadDocument({
    buffer: Buffer.from(await file.arrayBuffer()),
    filename: file.name,
    mimeType: file.type || null,
    entityTable,
    entityId,
    field: String(form.get('field') ?? 'attachment'),
    label: form.get('label') ? String(form.get('label')) : null,
    actorId: Number(actor.id),
  });
  return c.json(successBody(result, 'Dokumen tersimpan'), 200);
});

documentRoutes.openapi(downloadDocumentRoute, async (c) => {
  const { id } = c.req.valid('param');
  const result = await service.getDownloadUrl(id);
  return c.json(successBody(result, 'URL unduhan'), 200);
});

documentRoutes.openapi(deleteDocumentRoute, async (c) => {
  const { id } = c.req.valid('param');
  await service.removeDocument(id);
  return c.json(successBody(null, 'Dokumen dihapus'), 200);
});
