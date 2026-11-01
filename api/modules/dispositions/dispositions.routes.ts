import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { bearerAuth, type AuthUser } from '../../middleware/bearerAuth';
import { requireRole } from '../../middleware/roleGuard';
import { badRequest } from '../../shared/errors';
import { defaultHook } from '../../shared/openapi-hook';
import { errors, json, okResponse } from '../../shared/openapi';
import {
  DELETE_DISPOSITION_METHOD,
  GET_DISPOSITION_METHOD,
  PATCH_DISPOSITION_METHOD,
  POST_DISPOSITION_METHOD,
} from '../../shared/constant';
import { successBody } from '../../shared/response';
import {
  ChildParamSchema,
  ClassificationCreateResponseSchema,
  ClassificationInputSchema,
  ClassificationListQuerySchema,
  ClassificationListResponseSchema,
  ClassificationUpdateResponseSchema,
  DispositionCreateResponseSchema,
  DispositionFinalCreateResponseSchema,
  DispositionFinalInputSchema,
  DispositionInputSchema,
  DispositionUpdateResponseSchema,
  DispositionUpdateSchema,
  IdParamSchema,
  IncomingLetterCreateResponseSchema,
  IncomingLetterDetailResponseSchema,
  IncomingLetterFileResponseSchema,
  IncomingLetterFinalizeResponseSchema,
  IncomingLetterInputSchema,
  IncomingLetterListQuerySchema,
  IncomingLetterListResponseSchema,
  IncomingLetterUpdateResponseSchema,
  IncomingLetterUpdateSchema,
  ReferenceCreateResponseSchema,
  ReferenceInputSchema,
  UploadIncomingLetterFileSchema,
} from './schema';
import * as domain from './domain';

/**
 * Route modul disposisi — boundary HTTP saja. Surat masuk adalah korespondensi
 * kantor, jadi seluruh endpoint dibatasi untuk staf (verifikator/atasan/admin).
 */

export const dispositionRoutes = new OpenAPIHono({ defaultHook });

for (const prefix of [
  '/incoming-letters',
  '/incoming-letters/*',
  '/letter-classifications',
  '/letter-classifications/*',
]) {
  dispositionRoutes.use(prefix, bearerAuth, requireRole('verifikator', 'atasan'));
}

const actor = (c: Context): AuthUser => c.get('user');

// ---------------------------------------------------------------------------
// Surat masuk
// ---------------------------------------------------------------------------

const listIncomingLettersRoute = createRoute({
  ...GET_DISPOSITION_METHOD,
  path: '/incoming-letters',
  summary: 'Daftar surat masuk (cari nomor/asal/agenda)',
  request: {
    query: IncomingLetterListQuerySchema,
  },
  responses: {
    ...okResponse(IncomingLetterListResponseSchema, 'Daftar surat masuk', 'IncomingLetterListResponse'),
    ...errors([401]),
  },
});

const createIncomingLetterRoute = createRoute({
  ...POST_DISPOSITION_METHOD,
  path: '/incoming-letters',
  summary: 'Catat surat masuk',
  request: { body: json(IncomingLetterInputSchema) },
  responses: {
    ...okResponse(IncomingLetterCreateResponseSchema, 'Surat masuk dibuat', 'IncomingLetterCreateResponse'),
    ...errors([401, 422]),
  },
});

const getIncomingLetterRoute = createRoute({
  ...GET_DISPOSITION_METHOD,
  path: '/incoming-letters/{id}',
  summary: 'Detail surat masuk + disposisi, final, referensi, berkas',
  request: { params: IdParamSchema },
  responses: {
    ...okResponse(IncomingLetterDetailResponseSchema, 'Detail surat masuk', 'IncomingLetterDetailResponse'),
    ...errors([401, 404]),
  },
});

const updateIncomingLetterRoute = createRoute({
  ...PATCH_DISPOSITION_METHOD,
  path: '/incoming-letters/{id}',
  summary: 'Ubah surat masuk',
  request: { params: IdParamSchema, body: json(IncomingLetterUpdateSchema) },
  responses: {
    ...okResponse(IncomingLetterUpdateResponseSchema, 'Surat masuk diperbarui', 'IncomingLetterUpdateResponse'),
    ...errors([401, 404]),
  },
});

const deleteIncomingLetterRoute = createRoute({
  ...DELETE_DISPOSITION_METHOD,
  path: '/incoming-letters/{id}',
  summary: 'Hapus surat masuk',
  request: { params: IdParamSchema },
  responses: {
    ...okResponse(z.null(), 'Surat masuk dihapus', 'IncomingLetterDeleteResponse'),
    ...errors([401, 404]),
  },
});

const finalizeIncomingLetterRoute = createRoute({
  ...POST_DISPOSITION_METHOD,
  path: '/incoming-letters/{id}/finalize',
  summary: 'Finalisasi surat masuk (set status selesai)',
  request: { params: IdParamSchema },
  responses: {
    ...okResponse(IncomingLetterFinalizeResponseSchema, 'Surat difinalisasi', 'IncomingLetterFinalizeResponse'),
    ...errors([401, 404]),
  },
});

const uploadIncomingLetterFileRoute = createRoute({
  ...POST_DISPOSITION_METHOD,
  path: '/incoming-letters/{id}/file',
  summary: 'Unggah berkas surat masuk / SK',
  request: {
    params: IdParamSchema,
    body: {
      content: {
        'multipart/form-data': {
          schema: UploadIncomingLetterFileSchema,
        },
      },
    },
  },
  responses: {
    ...okResponse(IncomingLetterFileResponseSchema, 'Berkas tersimpan', 'IncomingLetterFileResponse'),
    ...errors([401, 404]),
  },
});

// ---------------------------------------------------------------------------
// Disposisi (pelaksana)
// ---------------------------------------------------------------------------

const addDispositionRoute = createRoute({
  ...POST_DISPOSITION_METHOD,
  path: '/incoming-letters/{id}/dispositions',
  summary: 'Tambah disposisi/pelaksana',
  request: { params: IdParamSchema, body: json(DispositionInputSchema) },
  responses: {
    ...okResponse(DispositionCreateResponseSchema, 'Disposisi ditambahkan', 'DispositionCreateResponse'),
    ...errors([401, 404]),
  },
});

const updateDispositionRoute = createRoute({
  ...PATCH_DISPOSITION_METHOD,
  path: '/incoming-letters/{id}/dispositions/{childId}',
  summary: 'Ubah status/data disposisi',
  request: { params: ChildParamSchema, body: json(DispositionUpdateSchema) },
  responses: {
    ...okResponse(DispositionUpdateResponseSchema, 'Disposisi diperbarui', 'DispositionUpdateResponse'),
    ...errors([401, 404]),
  },
});

const deleteDispositionRoute = createRoute({
  ...DELETE_DISPOSITION_METHOD,
  path: '/incoming-letters/{id}/dispositions/{childId}',
  summary: 'Hapus disposisi',
  request: { params: ChildParamSchema },
  responses: {
    ...okResponse(z.null(), 'Disposisi dihapus', 'DispositionDeleteResponse'),
    ...errors([401, 404]),
  },
});

// ---------------------------------------------------------------------------
// Final & referensi
// ---------------------------------------------------------------------------

const addFinalRoute = createRoute({
  ...POST_DISPOSITION_METHOD,
  path: '/incoming-letters/{id}/finals',
  summary: 'Tambah baris final',
  request: { params: IdParamSchema, body: json(DispositionFinalInputSchema) },
  responses: {
    ...okResponse(DispositionFinalCreateResponseSchema, 'Final ditambahkan', 'DispositionFinalCreateResponse'),
    ...errors([401, 404]),
  },
});

const deleteFinalRoute = createRoute({
  ...DELETE_DISPOSITION_METHOD,
  path: '/incoming-letters/{id}/finals/{childId}',
  summary: 'Hapus baris final',
  request: { params: ChildParamSchema },
  responses: {
    ...okResponse(z.null(), 'Final dihapus', 'DispositionFinalDeleteResponse'),
    ...errors([401, 404]),
  },
});

const addReferenceRoute = createRoute({
  ...POST_DISPOSITION_METHOD,
  path: '/incoming-letters/{id}/references',
  summary: 'Tambah referensi surat',
  request: { params: IdParamSchema, body: json(ReferenceInputSchema) },
  responses: {
    ...okResponse(ReferenceCreateResponseSchema, 'Referensi ditambahkan', 'ReferenceCreateResponse'),
    ...errors([401, 404]),
  },
});

const deleteReferenceRoute = createRoute({
  ...DELETE_DISPOSITION_METHOD,
  path: '/incoming-letters/{id}/references/{childId}',
  summary: 'Hapus referensi surat',
  request: { params: ChildParamSchema },
  responses: {
    ...okResponse(z.null(), 'Referensi dihapus', 'ReferenceDeleteResponse'),
    ...errors([401, 404]),
  },
});

// ---------------------------------------------------------------------------
// Klasifikasi surat
// ---------------------------------------------------------------------------

const listClassificationsRoute = createRoute({
  ...GET_DISPOSITION_METHOD,
  path: '/letter-classifications',
  summary: 'Daftar klasifikasi surat',
  request: { query: ClassificationListQuerySchema },
  responses: {
    ...okResponse(ClassificationListResponseSchema, 'Daftar klasifikasi', 'ClassificationListResponse'),
    ...errors([401]),
  },
});

const createClassificationRoute = createRoute({
  ...POST_DISPOSITION_METHOD,
  path: '/letter-classifications',
  summary: 'Tambah klasifikasi surat',
  request: { body: json(ClassificationInputSchema) },
  responses: {
    ...okResponse(ClassificationCreateResponseSchema, 'Klasifikasi dibuat', 'ClassificationCreateResponse'),
    ...errors([401, 422]),
  },
});

const updateClassificationRoute = createRoute({
  ...PATCH_DISPOSITION_METHOD,
  path: '/letter-classifications/{id}',
  summary: 'Ubah klasifikasi surat',
  request: { params: IdParamSchema, body: json(ClassificationInputSchema.partial()) },
  responses: {
    ...okResponse(ClassificationUpdateResponseSchema, 'Klasifikasi diperbarui', 'ClassificationUpdateResponse'),
    ...errors([401, 404]),
  },
});

const deleteClassificationRoute = createRoute({
  ...DELETE_DISPOSITION_METHOD,
  path: '/letter-classifications/{id}',
  summary: 'Hapus klasifikasi surat',
  request: { params: IdParamSchema },
  responses: {
    ...okResponse(z.null(), 'Klasifikasi dihapus', 'ClassificationDeleteResponse'),
    ...errors([401, 404]),
  },
});

dispositionRoutes.openapi(listIncomingLettersRoute, async (c) => {
  const query = c.req.valid('query');
  const result = await domain.listIncomingLetters({
    status: query.status,
    year: query.year,
    search: query.search,
    page: query.page,
    perPage: query.per_page,
  });
  return c.json(successBody(result, 'Daftar surat masuk'), 200);
});

dispositionRoutes.openapi(createIncomingLetterRoute, async (c) => {
  const body = c.req.valid('json');
  const result = await domain.createIncomingLetter(body, actor(c));
  return c.json(successBody(result, 'Surat masuk dibuat'), 200);
});

dispositionRoutes.openapi(getIncomingLetterRoute, async (c) => {
  const { id } = c.req.valid('param');
  const detail = await domain.getIncomingLetterDetail(id);
  return c.json(successBody(detail, 'Detail surat masuk'), 200);
});

dispositionRoutes.openapi(updateIncomingLetterRoute, async (c) => {
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const result = await domain.updateIncomingLetterById(id, body, actor(c));
  return c.json(successBody(result, 'Surat masuk diperbarui'), 200);
});

dispositionRoutes.openapi(deleteIncomingLetterRoute, async (c) => {
  const { id } = c.req.valid('param');
  await domain.removeIncomingLetter(id, actor(c));
  return c.json(successBody(null, 'Surat masuk dihapus'), 200);
});

dispositionRoutes.openapi(finalizeIncomingLetterRoute, async (c) => {
  const id = Number(c.req.param('id'));
  const result = await domain.finalizeIncomingLetterById(id, actor(c));
  return c.json(successBody(result, 'Surat masuk difinalisasi'), 200);
});

dispositionRoutes.openapi(uploadIncomingLetterFileRoute, async (c) => {
  const id = Number(c.req.param('id'));
  const form = await c.req.parseBody();
  const file = form.file;
  if (!(file instanceof File)) throw badRequest('Berkas wajib dilampirkan');
  const field = typeof form.field === 'string' ? form.field : 'sm';
  const result = await domain.attachIncomingLetterFile(
    id,
    {
      buffer: Buffer.from(await file.arrayBuffer()),
      filename: file.name || 'berkas',
      mimeType: file.type || null,
    },
    field,
    actor(c),
  );
  return c.json(successBody(result, 'Berkas surat tersimpan'), 200);
});

dispositionRoutes.openapi(addDispositionRoute, async (c) => {
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const result = await domain.addDisposition(id, body, actor(c));
  return c.json(successBody(result, 'Disposisi ditambahkan'), 200);
});

dispositionRoutes.openapi(updateDispositionRoute, async (c) => {
  const { id, childId } = c.req.valid('param');
  const body = c.req.valid('json');
  const result = await domain.updateDispositionById(id, childId, body, actor(c));
  return c.json(successBody(result, 'Disposisi diperbarui'), 200);
});

dispositionRoutes.openapi(deleteDispositionRoute, async (c) => {
  const { id, childId } = c.req.valid('param');
  await domain.removeDisposition(id, childId, actor(c));
  return c.json(successBody(null, 'Disposisi dihapus'), 200);
});

dispositionRoutes.openapi(addFinalRoute, async (c) => {
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const result = await domain.addFinal(id, body, actor(c));
  return c.json(successBody(result, 'Final ditambahkan'), 200);
});

dispositionRoutes.openapi(deleteFinalRoute, async (c) => {
  const { id, childId } = c.req.valid('param');
  await domain.removeFinal(id, childId, actor(c));
  return c.json(successBody(null, 'Final dihapus'), 200);
});

dispositionRoutes.openapi(addReferenceRoute, async (c) => {
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const result = await domain.addReference(id, body.reference_text, actor(c));
  return c.json(successBody(result, 'Referensi ditambahkan'), 200);
});

dispositionRoutes.openapi(deleteReferenceRoute, async (c) => {
  const { id, childId } = c.req.valid('param');
  await domain.removeReference(id, childId, actor(c));
  return c.json(successBody(null, 'Referensi dihapus'), 200);
});

dispositionRoutes.openapi(listClassificationsRoute, async (c) => {
  const query = c.req.valid('query');
  const items = await domain.listClassifications({
    search: query.search,
    activeOnly: query.active_only === 'true' || query.active_only === '1',
  });
  return c.json(successBody(items, 'Daftar klasifikasi surat'), 200);
});

dispositionRoutes.openapi(createClassificationRoute, async (c) => {
  const body = c.req.valid('json');
  const result = await domain.createClassification(body, actor(c));
  return c.json(successBody(result, 'Klasifikasi dibuat'), 200);
});

dispositionRoutes.openapi(updateClassificationRoute, async (c) => {
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const result = await domain.updateClassificationById(id, body, actor(c));
  return c.json(successBody(result, 'Klasifikasi diperbarui'), 200);
});

dispositionRoutes.openapi(deleteClassificationRoute, async (c) => {
  const { id } = c.req.valid('param');
  await domain.removeClassification(id, actor(c));
  return c.json(successBody(null, 'Klasifikasi dihapus'), 200);
});
