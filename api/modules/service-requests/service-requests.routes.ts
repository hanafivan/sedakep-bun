import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { bearerAuth, type AuthUser } from '../../middleware/bearerAuth';
import { requireRole } from '../../middleware/roleGuard';
import { badRequest } from '../../shared/errors';
import { defaultHook } from '../../shared/openapi-hook';
import { errors, json, okResponse } from '../../shared/openapi';
import {
  DELETE_SERVICE_REQUEST_METHOD,
  GET_SERVICE_REQUEST_METHOD,
  PATCH_SERVICE_REQUEST_METHOD,
  POST_SERVICE_REQUEST_METHOD,
} from '../../shared/constant';
import { successBody } from '../../shared/response';
import {
  GeneratedLetterResponseSchema,
  IdParamSchema,
  ServiceApproveResponseSchema,
  ServiceApproveSchema,
  ServiceCheckResponseSchema,
  ServiceCheckSchema,
  ServiceDocumentResponseSchema,
  ServiceFieldsResponseSchema,
  ServiceFieldsSchema,
  ServiceLetterSchema,
  ServiceMetaResponseSchema,
  ServicePdfResponseSchema,
  ServiceRequestCreateResponseSchema,
  ServiceRequestDetailResponseSchema,
  ServiceRequestInputSchema,
  ServiceRequestListQuerySchema,
  ServiceRequestListResponseSchema,
  ServiceRequestUpdateResponseSchema,
  ServiceRequestUpdateSchema,
  UploadServiceDocumentSchema,
} from './schema';
import * as domain from './domain';

/**
 * Route modul layanan kepegawaian — boundary HTTP saja.
 * PENTING: `/service-requests/meta` didaftarkan sebelum `/service-requests/{id}`
 * agar 'meta' tidak tertangkap sebagai {id}.
 */

export const serviceRequestRoutes = new OpenAPIHono({ defaultHook });

for (const prefix of ['/service-requests', '/service-requests/*']) {
  serviceRequestRoutes.use(prefix, bearerAuth);
}

for (const prefix of [
  '/service-requests/*/approve',
  '/service-requests/*/checks',
  '/service-requests/*/letters',
  '/service-requests/*/pdf',
]) {
  serviceRequestRoutes.use(prefix, requireRole('verifikator', 'atasan'));
}

const actor = (c: Context): AuthUser => c.get('user');
const seesAll = (user: AuthUser) =>
  user.role === 'admin' || user.role === 'verifikator' || user.role === 'atasan';

const serviceMetaRoute = createRoute({
  ...GET_SERVICE_REQUEST_METHOD,
  path: '/service-requests/meta',
  summary: 'Jenis layanan + field/dokumen/surat per jenis',
  responses: {
    ...okResponse(ServiceMetaResponseSchema, 'Metadata layanan', 'ServiceMetaResponse'),
    ...errors([401]),
  },
});

const listServiceRequestsRoute = createRoute({
  ...GET_SERVICE_REQUEST_METHOD,
  path: '/service-requests',
  summary: 'Daftar permohonan layanan',
  request: {
    query: ServiceRequestListQuerySchema,
  },
  responses: {
    ...okResponse(
      ServiceRequestListResponseSchema,
      'Daftar permohonan layanan',
      'ServiceRequestListResponse',
    ),
    ...errors([401]),
  },
});

const createServiceRequestRoute = createRoute({
  ...POST_SERVICE_REQUEST_METHOD,
  path: '/service-requests',
  summary: 'Ajukan permohonan layanan',
  request: { body: json(ServiceRequestInputSchema) },
  responses: {
    ...okResponse(ServiceRequestCreateResponseSchema, 'Permohonan dibuat', 'ServiceRequestCreateResponse'),
    ...errors([401, 422]),
  },
});

const getServiceRequestRoute = createRoute({
  ...GET_SERVICE_REQUEST_METHOD,
  path: '/service-requests/{id}',
  summary: 'Detail permohonan + field, berkas, verifikasi, surat',
  request: { params: IdParamSchema },
  responses: {
    ...okResponse(ServiceRequestDetailResponseSchema, 'Detail permohonan', 'ServiceRequestDetailResponse'),
    ...errors([401, 404], { 403: 'Bukan pemilik' }),
  },
});

const updateServiceRequestRoute = createRoute({
  ...PATCH_SERVICE_REQUEST_METHOD,
  path: '/service-requests/{id}',
  summary: 'Ubah data permohonan (belum disetujui)',
  request: { params: IdParamSchema, body: json(ServiceRequestUpdateSchema) },
  responses: {
    ...okResponse(ServiceRequestUpdateResponseSchema, 'Permohonan diperbarui', 'ServiceRequestUpdateResponse'),
    ...errors([401, 404], { 403: 'Bukan pemilik' }),
  },
});

const deleteServiceRequestRoute = createRoute({
  ...DELETE_SERVICE_REQUEST_METHOD,
  path: '/service-requests/{id}',
  summary: 'Hapus permohonan (belum disetujui)',
  request: { params: IdParamSchema },
  responses: {
    ...okResponse(z.null(), 'Permohonan dihapus', 'ServiceRequestDeleteResponse'),
    ...errors([401, 404], { 403: 'Bukan pemilik' }),
  },
});

const generateServicePdfRoute = createRoute({
  ...POST_SERVICE_REQUEST_METHOD,
  path: '/service-requests/{id}/pdf',
  summary: 'Hasilkan PDF surat pengantar/SPHD/SK + QR verifikasi (staf)',
  request: { params: IdParamSchema },
  responses: {
    ...okResponse(ServicePdfResponseSchema, 'PDF dibuat', 'ServicePdfResponse'),
    ...errors([401, 404], { 403: 'Bukan staf' }),
  },
});

const approveServiceRequestRoute = createRoute({
  ...POST_SERVICE_REQUEST_METHOD,
  path: '/service-requests/{id}/approve',
  summary: 'Setujui / tolak / batalkan permohonan (staf)',
  request: { params: IdParamSchema, body: json(ServiceApproveSchema) },
  responses: {
    ...okResponse(ServiceApproveResponseSchema, 'Keputusan tersimpan', 'ServiceApproveResponse'),
    ...errors([401, 404], { 403: 'Bukan staf' }),
  },
});

const setServiceFieldsRoute = createRoute({
  ...POST_SERVICE_REQUEST_METHOD,
  path: '/service-requests/{id}/fields',
  summary: 'Simpan nilai field spesifik layanan',
  request: { params: IdParamSchema, body: json(ServiceFieldsSchema) },
  responses: {
    ...okResponse(ServiceFieldsResponseSchema, 'Field tersimpan', 'ServiceFieldsResponse'),
    ...errors([401, 404], { 403: 'Bukan pemilik' }),
  },
});

const uploadServiceDocumentRoute = createRoute({
  ...POST_SERVICE_REQUEST_METHOD,
  path: '/service-requests/{id}/documents',
  summary: 'Unggah berkas persyaratan layanan',
  request: {
    params: IdParamSchema,
    body: {
      content: {
        'multipart/form-data': {
          schema: UploadServiceDocumentSchema,
        },
      },
    },
  },
  responses: {
    ...okResponse(ServiceDocumentResponseSchema, 'Dokumen tersimpan', 'ServiceDocumentResponse'),
    ...errors([401, 404], { 403: 'Bukan pemilik' }),
  },
});

const addServiceCheckRoute = createRoute({
  ...POST_SERVICE_REQUEST_METHOD,
  path: '/service-requests/{id}/checks',
  summary: 'Catat hasil verifikasi fisik/data (staf)',
  request: { params: IdParamSchema, body: json(ServiceCheckSchema) },
  responses: {
    ...okResponse(ServiceCheckResponseSchema, 'Verifikasi tersimpan', 'ServiceCheckResponse'),
    ...errors([401, 404], { 403: 'Bukan staf' }),
  },
});

const addGeneratedLetterRoute = createRoute({
  ...POST_SERVICE_REQUEST_METHOD,
  path: '/service-requests/{id}/letters',
  summary: 'Catat nomor surat yang diterbitkan (SPHD, SPPID, SK, Suket) — staf',
  request: { params: IdParamSchema, body: json(ServiceLetterSchema) },
  responses: {
    ...okResponse(GeneratedLetterResponseSchema, 'Surat dicatat', 'GeneratedLetterResponse'),
    ...errors([401, 404], { 403: 'Bukan staf' }),
  },
});

serviceRequestRoutes.openapi(serviceMetaRoute, async (c) => {
  return c.json(successBody(domain.getServiceMeta(), 'Metadata layanan'), 200);
});

serviceRequestRoutes.openapi(listServiceRequestsRoute, async (c) => {
  const query = c.req.valid('query');
  const user = actor(c);
  const scopedUserId = query.user_id ?? (seesAll(user) ? undefined : Number(user.id));
  const result = await domain.listServiceRequests({
    serviceType: query.service_type,
    status: query.status,
    userId: scopedUserId,
    search: query.search,
    page: query.page,
    perPage: query.per_page,
  });
  return c.json(successBody(result, 'Daftar permohonan layanan'), 200);
});

serviceRequestRoutes.openapi(createServiceRequestRoute, async (c) => {
  const body = c.req.valid('json');
  const user = actor(c);
  const requested = body.user_id ?? Number(user.id);
  const userId = user.role === 'admin' ? requested : Number(user.id);
  const result = await domain.createServiceRequest({ ...body, user_id: userId }, user);
  return c.json(successBody(result, 'Permohonan layanan dibuat'), 200);
});

serviceRequestRoutes.openapi(getServiceRequestRoute, async (c) => {
  const { id } = c.req.valid('param');
  const detail = await domain.getServiceRequestDetail(id);
  if (!domain.canViewService(actor(c), detail)) {
    throw badRequest('Tidak berhak melihat permohonan milik pegawai lain');
  }
  return c.json(successBody(detail, 'Detail permohonan layanan'), 200);
});

serviceRequestRoutes.openapi(updateServiceRequestRoute, async (c) => {
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const result = await domain.updateServiceRequestById(id, body, actor(c));
  return c.json(successBody(result, 'Permohonan layanan diperbarui'), 200);
});

serviceRequestRoutes.openapi(deleteServiceRequestRoute, async (c) => {
  const { id } = c.req.valid('param');
  await domain.removeServiceRequest(id, actor(c));
  return c.json(successBody(null, 'Permohonan layanan dihapus'), 200);
});

serviceRequestRoutes.openapi(generateServicePdfRoute, async (c) => {
  const id = Number(c.req.param('id'));
  const result = await domain.generateServiceLetterPdf(id, actor(c));
  return c.json(successBody(result, 'PDF surat layanan dibuat'), 200);
});

serviceRequestRoutes.openapi(approveServiceRequestRoute, async (c) => {
  const id = Number(c.req.param('id'));
  const body = c.req.valid('json');
  const result = await domain.decideServiceRequest(id, body, actor(c));
  return c.json(successBody(result, 'Keputusan tersimpan'), 200);
});

serviceRequestRoutes.openapi(setServiceFieldsRoute, async (c) => {
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const result = await domain.setServiceFields(id, body.fields, actor(c));
  return c.json(successBody(result, 'Field tersimpan'), 200);
});

serviceRequestRoutes.openapi(uploadServiceDocumentRoute, async (c) => {
  const id = Number(c.req.param('id'));
  const form = await c.req.parseBody();
  const file = form.file;
  const label = form.label;
  if (!(file instanceof File)) throw badRequest('Berkas wajib dilampirkan');
  if (typeof label !== 'string' || !label) throw badRequest('Label dokumen wajib diisi');
  const result = await domain.attachServiceDocument(
    id,
    label,
    {
      buffer: Buffer.from(await file.arrayBuffer()),
      filename: file.name || 'berkas',
      mimeType: file.type || null,
    },
    actor(c),
  );
  return c.json(successBody(result, 'Dokumen tersimpan'), 200);
});

serviceRequestRoutes.openapi(addServiceCheckRoute, async (c) => {
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const result = await domain.addServiceCheck(id, body, actor(c));
  return c.json(successBody(result, 'Verifikasi tersimpan'), 200);
});

serviceRequestRoutes.openapi(addGeneratedLetterRoute, async (c) => {
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const result = await domain.addGeneratedLetter(id, body, actor(c));
  return c.json(successBody(result, 'Surat dicatat'), 200);
});
