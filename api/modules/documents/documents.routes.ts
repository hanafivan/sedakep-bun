import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { bearerAuth } from '../../middleware/bearerAuth';
import { defaultHook } from '../../shared/openapi-hook';
import { successBody } from '../../shared/response';
import { errors, okResponse } from '../../shared/openapi';
import {
  DELETE_DOCUMENT_METHOD,
  GET_DOCUMENT_METHOD,
  POST_DOCUMENT_METHOD,
} from '../../shared/constant';
import {
  DocumentDownloadResponseSchema,
  DocumentSchema,
  EntityDocumentsQuerySchema,
  EntityDocumentsResponseSchema,
  IdParamSchema,
  UnlinkedDocumentsResponseSchema,
  UploadDocumentFormSchema,
  UploadedDocumentSchema,
} from './schema';
import * as domain from './domain';

/** Route dokumen — semua endpoint wajib login. */

export const documentRoutes = new OpenAPIHono({ defaultHook });

documentRoutes.use('*', bearerAuth);

const listEntityDocumentsRoute = createRoute({
  ...GET_DOCUMENT_METHOD,
  path: '/',
  summary: 'Dokumen milik satu entitas',
  request: { query: EntityDocumentsQuerySchema },
  responses: {
    ...okResponse(EntityDocumentsResponseSchema, 'Daftar dokumen', 'EntityDocumentsResponse'),
    ...errors([401]),
  },
});

documentRoutes.openapi(listEntityDocumentsRoute, async (c) => {
  const query = c.req.valid('query');
  const documents = await domain.listByEntity(query.entity_table, query.entity_id);
  return c.json(successBody(documents, 'Daftar dokumen entitas'), 200);
});

const orphanDocumentsRoute = createRoute({
  ...GET_DOCUMENT_METHOD,
  path: '/unlinked',
  summary: 'Dokumen yang belum tertaut (modul belum diport)',
  responses: {
    ...okResponse(UnlinkedDocumentsResponseSchema, 'Daftar dokumen tanpa tautan', 'UnlinkedDocumentsResponse'),
    ...errors([401]),
  },
});

documentRoutes.openapi(orphanDocumentsRoute, async (c) => {
  const documents = await domain.listUnlinked();
  return c.json(successBody(documents, 'Dokumen belum tertaut'), 200);
});

const uploadDocumentRoute = createRoute({
  ...POST_DOCUMENT_METHOD,
  path: '/',
  summary: 'Unggah dokumen dan tautkan ke satu entitas',
  request: {
    body: {
      content: {
        'multipart/form-data': {
          schema: UploadDocumentFormSchema,
        },
      },
    },
  },
  responses: {
    ...okResponse(UploadedDocumentSchema, 'Dokumen tersimpan', 'UploadDocumentResponse'),
    ...errors([401], { 422: 'Berkas tidak valid' }),
  },
});

documentRoutes.openapi(uploadDocumentRoute, async (c) => {
  const form = c.req.valid('form');
  const actor = c.get('user');
  const result = await domain.uploadDocument({
    buffer: Buffer.from(await form.file.arrayBuffer()),
    filename: form.file.name,
    mimeType: form.file.type || null,
    entityTable: form.entity_table,
    entityId: form.entity_id,
    field: form.field,
    label: form.label ?? null,
    actorId: Number(actor.id),
  });
  return c.json(successBody(result, 'Dokumen tersimpan'), 200);
});

const downloadDocumentRoute = createRoute({
  ...GET_DOCUMENT_METHOD,
  path: '/{id}/download',
  summary: 'Unduh dokumen (URL presigned, tidak pernah expose path storage)',
  request: { params: IdParamSchema },
  responses: {
    ...okResponse(DocumentDownloadResponseSchema, 'URL unduhan sementara', 'DocumentDownloadResponse'),
    ...errors([401], { 404: 'Dokumen tidak ditemukan' }),
  },
});

documentRoutes.openapi(downloadDocumentRoute, async (c) => {
  const { id } = c.req.valid('param');
  const result = await domain.getDownloadUrl(id);
  return c.json(successBody(result, 'URL unduhan'), 200);
});

const deleteDocumentRoute = createRoute({
  ...DELETE_DOCUMENT_METHOD,
  path: '/{id}',
  summary: 'Hapus dokumen beserta objeknya',
  request: { params: IdParamSchema },
  responses: {
    ...okResponse(z.null(), 'Dokumen dihapus', 'DeleteDocumentResponse'),
    ...errors([401], { 404: 'Dokumen tidak ditemukan' }),
  },
});

documentRoutes.openapi(deleteDocumentRoute, async (c) => {
  const { id } = c.req.valid('param');
  await domain.removeDocument(id);
  return c.json(successBody(null, 'Dokumen dihapus'), 200);
});
