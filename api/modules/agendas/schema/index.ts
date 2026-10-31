import { z } from 'zod';
import { createRoute } from '@hono/zod-openapi';
import { AgendaSchema, errorResponses, json, ok } from './shared';

/**
 * Route modul agenda. Cerminan legacy `agenda/*.php`: daftar agenda,
 * tambah/edit/hapus, dan input laporan.
 */

const DateTimeSchema = z.string().min(4).max(30);

export const AgendaInputSchema = z
  .object({
    title: z.string().min(1).max(2000),
    place: z.string().max(2000).optional(),
    start_at: DateTimeSchema.optional(),
    end_at: DateTimeSchema.optional(),
    report: z.string().max(8000).optional(),
  })
  .openapi('AgendaInput');

export const AgendaUpdateSchema = AgendaInputSchema.partial().openapi('AgendaUpdate');

export const AgendaReportSchema = z
  .object({ report: z.string().min(1).max(8000) })
  .openapi('AgendaReport');

const IdParamSchema = z.object({ id: z.coerce.number().int().positive() });

export const listAgendasRoute = createRoute({
  method: 'get',
  path: '/agendas',
  tags: ['Agenda'],
  summary: 'Daftar agenda (cari judul/nama)',
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      user_id: z.coerce.number().int().positive().optional(),
      year: z.coerce.number().int().optional(),
      month: z.coerce.number().int().min(1).max(12).optional(),
      search: z.string().optional(),
      page: z.coerce.number().int().positive().optional(),
      per_page: z.coerce.number().int().positive().max(200).optional(),
    }),
  },
  responses: {
    200: {
      description: 'Daftar agenda',
      ...json(
        ok(
          z.object({
            items: z.array(AgendaSchema),
            total: z.number(),
            page: z.number(),
            per_page: z.number(),
            total_pages: z.number(),
          }),
          'AgendaListResponse',
        ),
      ),
    },
    ...errorResponses({ 401: 'Token tidak valid' }),
  },
});

export const createAgendaRoute = createRoute({
  method: 'post',
  path: '/agendas',
  tags: ['Agenda'],
  summary: 'Tambah agenda',
  security: [{ bearerAuth: [] }],
  request: { body: json(AgendaInputSchema) },
  responses: {
    200: {
      description: 'Agenda dibuat',
      ...json(ok(z.record(z.any()), 'AgendaCreateResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 422: 'Validasi gagal' }),
  },
});

export const getAgendaRoute = createRoute({
  method: 'get',
  path: '/agendas/{id}',
  tags: ['Agenda'],
  summary: 'Detail agenda + berkas',
  security: [{ bearerAuth: [] }],
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: 'Detail agenda',
      ...json(ok(z.record(z.any()), 'AgendaDetailResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan pemilik', 404: 'Tidak ditemukan' }),
  },
});

export const updateAgendaRoute = createRoute({
  method: 'patch',
  path: '/agendas/{id}',
  tags: ['Agenda'],
  summary: 'Ubah agenda',
  security: [{ bearerAuth: [] }],
  request: { params: IdParamSchema, body: json(AgendaUpdateSchema) },
  responses: {
    200: {
      description: 'Agenda diperbarui',
      ...json(ok(z.record(z.any()), 'AgendaUpdateResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan pemilik', 404: 'Tidak ditemukan' }),
  },
});

export const deleteAgendaRoute = createRoute({
  method: 'delete',
  path: '/agendas/{id}',
  tags: ['Agenda'],
  summary: 'Hapus agenda',
  security: [{ bearerAuth: [] }],
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: 'Agenda dihapus',
      ...json(ok(z.null(), 'AgendaDeleteResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan pemilik', 404: 'Tidak ditemukan' }),
  },
});

export const setAgendaReportRoute = createRoute({
  method: 'post',
  path: '/agendas/{id}/report',
  tags: ['Agenda'],
  summary: 'Input/ubah laporan agenda',
  security: [{ bearerAuth: [] }],
  request: { params: IdParamSchema, body: json(AgendaReportSchema) },
  responses: {
    200: {
      description: 'Laporan tersimpan',
      ...json(ok(z.record(z.any()), 'AgendaReportResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan pemilik', 404: 'Tidak ditemukan' }),
  },
});

export const uploadAgendaFileRoute = createRoute({
  method: 'post',
  path: '/agendas/{id}/file',
  tags: ['Agenda'],
  summary: 'Unggah berkas laporan agenda',
  security: [{ bearerAuth: [] }],
  request: {
    params: IdParamSchema,
    body: { content: { 'multipart/form-data': { schema: z.object({ file: z.any() }) } } },
  },
  responses: {
    200: {
      description: 'Berkas tersimpan',
      ...json(ok(z.record(z.any()), 'AgendaFileResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan pemilik', 404: 'Tidak ditemukan' }),
  },
});
