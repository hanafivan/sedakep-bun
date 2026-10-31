import { z } from 'zod';
import { createRoute } from '@hono/zod-openapi';

/** Schema + definisi route modul dokumen. */

export const DocumentSchema = z.object({
  id: z.number(),
  original_filename: z.string(),
  mime_type: z.string().nullable(),
  size_bytes: z.number().nullable(),
  status: z.string(),
  created_at: z.string(),
}).openapi('Document');

export const EntityDocumentsQuerySchema = z.object({
  entity_table: z.string().min(1),
  entity_id: z.coerce.number().int().positive(),
});

export const IdParamSchema = z.object({ id: z.coerce.number().int().positive() });

export const ApiErrorSchema = z.object({
  success: z.literal(false),
  data: z.null(),
  message: z.string(),
  code: z.number(),
  details: z.any().optional(),
}).openapi('ApiError');

const ok = <T extends z.ZodTypeAny>(data: T, name: string) =>
  z.object({
    success: z.literal(true),
    data,
    message: z.string(),
    code: z.number(),
  }).openapi(name);

const json = <T extends z.ZodTypeAny>(schema: T) => ({
  content: { 'application/json': { schema } },
});

const errorResponses = (descriptions: Record<number, string>) =>
  Object.fromEntries(
    Object.entries(descriptions).map(([code, description]) => [
      Number(code),
      { description, content: { 'application/json': { schema: ApiErrorSchema } } },
    ]),
  );

export const listEntityDocumentsRoute = createRoute({
  method: 'get',
  path: '/documents',
  tags: ['Documents'],
  summary: 'Dokumen milik satu entitas',
  security: [{ bearerAuth: [] }],
  request: { query: EntityDocumentsQuerySchema },
  responses: {
    200: {
      description: 'Daftar dokumen',
      ...json(ok(z.array(DocumentSchema), 'EntityDocumentsResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid' }),
  },
});

export const downloadDocumentRoute = createRoute({
  method: 'get',
  path: '/documents/{id}/download',
  tags: ['Documents'],
  summary: 'Unduh dokumen (URL presigned, tidak pernah expose path storage)',
  security: [{ bearerAuth: [] }],
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: 'URL unduhan sementara',
      ...json(ok(
        z.object({
          url: z.string(),
          filename: z.string(),
          expires_at: z.string(),
        }),
        'DocumentDownloadResponse',
      )),
    },
    ...errorResponses({ 401: 'Token tidak valid', 404: 'Dokumen tidak ditemukan' }),
  },
});

export const orphanDocumentsRoute = createRoute({
  method: 'get',
  path: '/documents/unlinked',
  tags: ['Documents'],
  summary: 'Dokumen yang belum tertaut (modul belum diport)',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Daftar dokumen tanpa tautan',
      ...json(ok(z.array(DocumentSchema), 'UnlinkedDocumentsResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid' }),
  },
});

export const UploadedDocumentSchema = z.object({
  id: z.number(),
  object_key: z.string(),
  original_filename: z.string(),
  size_bytes: z.number(),
  sha256: z.string(),
}).openapi('UploadedDocument');

export const uploadDocumentRoute = createRoute({
  method: 'post',
  path: '/documents',
  tags: ['Documents'],
  summary: 'Unggah dokumen dan tautkan ke satu entitas',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({
            file: z.any(),
            entity_table: z.string().min(1),
            entity_id: z.coerce.number().int().positive(),
            field: z.string().min(1).default('attachment'),
            label: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Dokumen tersimpan',
      ...json(ok(UploadedDocumentSchema, 'UploadDocumentResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 422: 'Berkas tidak valid' }),
  },
});

export const deleteDocumentRoute = createRoute({
  method: 'delete',
  path: '/documents/{id}',
  tags: ['Documents'],
  summary: 'Hapus dokumen beserta objeknya',
  security: [{ bearerAuth: [] }],
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: 'Dokumen dihapus',
      ...json(ok(z.null(), 'DeleteDocumentResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 404: 'Dokumen tidak ditemukan' }),
  },
});
