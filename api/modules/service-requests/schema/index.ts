import { z } from 'zod';
import { createRoute } from '@hono/zod-openapi';
import { SERVICE_TYPE_VALUES } from '../domain/service-types';
import { ServiceRequestSchema, errorResponses, json, ok } from './shared';

/**
 * Route modul layanan kepegawaian. Satu modul generik untuk pensiun, gelar,
 * karpeg, karis/karsu, BPJS, taspen, satya lencana, izin belajar, tugas belajar,
 * PMK, SKMI/SKPP, dan pangkat — dibedakan `service_type`.
 */

const ServiceTypeEnum = z.enum(
  SERVICE_TYPE_VALUES as unknown as [string, ...string[]],
);
const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD');
const IdParamSchema = z.object({ id: z.coerce.number().int().positive() });

export const ServiceRequestInputSchema = z
  .object({
    service_type: ServiceTypeEnum,
    user_id: z.coerce.number().int().positive().optional(),
    title: z.string().max(255).optional(),
    phone: z.string().max(30).optional(),
    subtype: z.string().max(50).optional(),
    approver_1_name: z.string().max(150).optional(),
    approver_1_nip: z.string().max(18).optional(),
    approver_1_position: z.string().max(150).optional(),
    fields: z.record(z.string()).optional(),
  })
  .openapi('ServiceRequestInput');

export const ServiceRequestUpdateSchema = ServiceRequestInputSchema.partial()
  .omit({ service_type: true, user_id: true })
  .openapi('ServiceRequestUpdate');

export const ServiceApproveSchema = z
  .object({
    decision: z.enum(['accepted', 'rejected', 'cancelled']),
    note: z.string().max(1000).optional(),
  })
  .openapi('ServiceRequestApprove');

export const ServiceFieldsSchema = z
  .object({ fields: z.record(z.string()) })
  .openapi('ServiceRequestFields');

export const ServiceCheckSchema = z
  .object({
    check_type: z.string().min(1).max(50),
    result: z.string().max(50).optional(),
    notes: z.string().max(2000).optional(),
  })
  .openapi('ServiceRequestCheck');

export const ServiceLetterSchema = z
  .object({
    letter_type: z.enum(['sphd', 'sppid', 'sk', 'suket']),
    number: z.string().max(100).optional(),
    issued_at: DateSchema.optional(),
  })
  .openapi('GeneratedLetter');

export const serviceMetaRoute = createRoute({
  method: 'get',
  path: '/service-requests/meta',
  tags: ['Service Requests'],
  summary: 'Jenis layanan + field/dokumen/surat per jenis',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Metadata layanan',
      ...json(ok(z.record(z.any()), 'ServiceMetaResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid' }),
  },
});

export const listServiceRequestsRoute = createRoute({
  method: 'get',
  path: '/service-requests',
  tags: ['Service Requests'],
  summary: 'Daftar permohonan layanan (filter jenis/status/cari)',
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      service_type: z.string().optional(),
      status: z.string().optional(),
      user_id: z.coerce.number().int().positive().optional(),
      search: z.string().optional(),
      page: z.coerce.number().int().positive().optional(),
      per_page: z.coerce.number().int().positive().max(200).optional(),
    }),
  },
  responses: {
    200: {
      description: 'Daftar permohonan',
      ...json(
        ok(
          z.object({
            items: z.array(ServiceRequestSchema),
            total: z.number(),
            page: z.number(),
            per_page: z.number(),
            total_pages: z.number(),
          }),
          'ServiceRequestListResponse',
        ),
      ),
    },
    ...errorResponses({ 401: 'Token tidak valid' }),
  },
});

export const createServiceRequestRoute = createRoute({
  method: 'post',
  path: '/service-requests',
  tags: ['Service Requests'],
  summary: 'Buat permohonan layanan',
  security: [{ bearerAuth: [] }],
  request: { body: json(ServiceRequestInputSchema) },
  responses: {
    200: {
      description: 'Permohonan dibuat',
      ...json(ok(z.record(z.any()), 'ServiceRequestCreateResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 422: 'Validasi gagal' }),
  },
});

export const getServiceRequestRoute = createRoute({
  method: 'get',
  path: '/service-requests/{id}',
  tags: ['Service Requests'],
  summary: 'Detail layanan + field, dokumen, verifikasi, surat',
  security: [{ bearerAuth: [] }],
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: 'Detail permohonan',
      ...json(ok(z.record(z.any()), 'ServiceRequestDetailResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan pemilik', 404: 'Tidak ditemukan' }),
  },
});

export const updateServiceRequestRoute = createRoute({
  method: 'patch',
  path: '/service-requests/{id}',
  tags: ['Service Requests'],
  summary: 'Ubah permohonan layanan',
  security: [{ bearerAuth: [] }],
  request: { params: IdParamSchema, body: json(ServiceRequestUpdateSchema) },
  responses: {
    200: {
      description: 'Permohonan diperbarui',
      ...json(ok(z.record(z.any()), 'ServiceRequestUpdateResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan pemilik', 404: 'Tidak ditemukan' }),
  },
});

export const deleteServiceRequestRoute = createRoute({
  method: 'delete',
  path: '/service-requests/{id}',
  tags: ['Service Requests'],
  summary: 'Hapus permohonan layanan',
  security: [{ bearerAuth: [] }],
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: 'Permohonan dihapus',
      ...json(ok(z.null(), 'ServiceRequestDeleteResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan pemilik', 404: 'Tidak ditemukan' }),
  },
});

export const generateServicePdfRoute = createRoute({
  method: 'post',
  path: '/service-requests/{id}/pdf',
  tags: ['Service Requests'],
  summary: 'Hasilkan PDF surat layanan (SPHD/SK) + QR',
  security: [{ bearerAuth: [] }],
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: 'PDF dibuat',
      ...json(ok(z.record(z.any()), 'ServicePdfResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan staf', 404: 'Tidak ditemukan' }),
  },
});

export const approveServiceRequestRoute = createRoute({
  method: 'post',
  path: '/service-requests/{id}/approve',
  tags: ['Service Requests'],
  summary: 'Keputusan verifikator/admin (terima/tolak/batal)',
  security: [{ bearerAuth: [] }],
  request: { params: IdParamSchema, body: json(ServiceApproveSchema) },
  responses: {
    200: {
      description: 'Keputusan tersimpan',
      ...json(ok(z.record(z.any()), 'ServiceRequestApproveResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan staf', 404: 'Tidak ditemukan' }),
  },
});

export const setServiceFieldsRoute = createRoute({
  method: 'post',
  path: '/service-requests/{id}/fields',
  tags: ['Service Requests'],
  summary: 'Simpan nilai spesifik jenis layanan',
  security: [{ bearerAuth: [] }],
  request: { params: IdParamSchema, body: json(ServiceFieldsSchema) },
  responses: {
    200: {
      description: 'Field tersimpan',
      ...json(ok(z.record(z.any()), 'ServiceFieldResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan pemilik', 404: 'Tidak ditemukan' }),
  },
});

export const uploadServiceDocumentRoute = createRoute({
  method: 'post',
  path: '/service-requests/{id}/documents',
  tags: ['Service Requests'],
  summary: 'Unggah dokumen berlabel',
  security: [{ bearerAuth: [] }],
  request: {
    params: IdParamSchema,
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({ file: z.any(), label: z.string() }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Dokumen tersimpan',
      ...json(ok(z.record(z.any()), 'ServiceDocumentResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan pemilik', 404: 'Tidak ditemukan' }),
  },
});

export const addServiceCheckRoute = createRoute({
  method: 'post',
  path: '/service-requests/{id}/checks',
  tags: ['Service Requests'],
  summary: 'Catat verifikasi berkas',
  security: [{ bearerAuth: [] }],
  request: { params: IdParamSchema, body: json(ServiceCheckSchema) },
  responses: {
    200: {
      description: 'Verifikasi tersimpan',
      ...json(ok(z.record(z.any()), 'ServiceCheckResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan staf', 404: 'Tidak ditemukan' }),
  },
});

export const addGeneratedLetterRoute = createRoute({
  method: 'post',
  path: '/service-requests/{id}/letters',
  tags: ['Service Requests'],
  summary: 'Catat surat terbit (SPHD/SPPID/SK/Suket)',
  security: [{ bearerAuth: [] }],
  request: { params: IdParamSchema, body: json(ServiceLetterSchema) },
  responses: {
    200: {
      description: 'Surat dicatat',
      ...json(ok(z.record(z.any()), 'GeneratedLetterResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan staf', 404: 'Tidak ditemukan' }),
  },
});
