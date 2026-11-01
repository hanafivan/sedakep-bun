import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { bearerAuth, type AuthUser } from '../../middleware/bearerAuth';
import { badRequest } from '../../shared/errors';
import { defaultHook } from '../../shared/openapi-hook';
import { errors, json, okResponse } from '../../shared/openapi';
import {
  DELETE_AGENDA_METHOD,
  GET_AGENDA_METHOD,
  PATCH_AGENDA_METHOD,
  POST_AGENDA_METHOD,
} from '../../shared/constant';
import { successBody } from '../../shared/response';
import {
  AgendaCreateResponseSchema,
  AgendaDetailResponseSchema,
  AgendaFileResponseSchema,
  AgendaInputSchema,
  AgendaListQuerySchema,
  AgendaListResponseSchema,
  AgendaReportResponseSchema,
  AgendaReportSchema,
  AgendaUpdateResponseSchema,
  AgendaUpdateSchema,
  IdParamSchema,
  UploadAgendaFileSchema,
} from './schema';
import * as domain from './domain';

/** Route modul agenda — boundary HTTP saja. */

export const agendaRoutes = new OpenAPIHono({ defaultHook });

for (const prefix of ['/agendas', '/agendas/*']) {
  agendaRoutes.use(prefix, bearerAuth);
}

const actor = (c: Context): AuthUser => c.get('user');
const seesAll = (user: AuthUser) =>
  user.role === 'admin' || user.role === 'verifikator' || user.role === 'atasan';

const listAgendasRoute = createRoute({
  ...GET_AGENDA_METHOD,
  path: '/agendas',
  summary: 'Daftar agenda (cari judul/nama)',
  request: {
    query: AgendaListQuerySchema,
  },
  responses: {
    ...okResponse(AgendaListResponseSchema, 'Daftar agenda', 'AgendaListResponse'),
    ...errors([401]),
  },
});

const createAgendaRoute = createRoute({
  ...POST_AGENDA_METHOD,
  path: '/agendas',
  summary: 'Tambah agenda',
  request: { body: json(AgendaInputSchema) },
  responses: {
    ...okResponse(AgendaCreateResponseSchema, 'Agenda dibuat', 'AgendaCreateResponse'),
    ...errors([401, 422]),
  },
});

const getAgendaRoute = createRoute({
  ...GET_AGENDA_METHOD,
  path: '/agendas/{id}',
  summary: 'Detail agenda + berkas',
  request: { params: IdParamSchema },
  responses: {
    ...okResponse(AgendaDetailResponseSchema, 'Detail agenda', 'AgendaDetailResponse'),
    ...errors([401, 404], { 403: 'Bukan pemilik' }),
  },
});

const updateAgendaRoute = createRoute({
  ...PATCH_AGENDA_METHOD,
  path: '/agendas/{id}',
  summary: 'Ubah agenda',
  request: { params: IdParamSchema, body: json(AgendaUpdateSchema) },
  responses: {
    ...okResponse(AgendaUpdateResponseSchema, 'Agenda diperbarui', 'AgendaUpdateResponse'),
    ...errors([401, 404], { 403: 'Bukan pemilik' }),
  },
});

const deleteAgendaRoute = createRoute({
  ...DELETE_AGENDA_METHOD,
  path: '/agendas/{id}',
  summary: 'Hapus agenda',
  request: { params: IdParamSchema },
  responses: {
    ...okResponse(z.null(), 'Agenda dihapus', 'AgendaDeleteResponse'),
    ...errors([401, 404], { 403: 'Bukan pemilik' }),
  },
});

const setAgendaReportRoute = createRoute({
  ...POST_AGENDA_METHOD,
  path: '/agendas/{id}/report',
  summary: 'Input/ubah laporan agenda',
  request: { params: IdParamSchema, body: json(AgendaReportSchema) },
  responses: {
    ...okResponse(AgendaReportResponseSchema, 'Laporan tersimpan', 'AgendaReportResponse'),
    ...errors([401, 404], { 403: 'Bukan pemilik' }),
  },
});

const uploadAgendaFileRoute = createRoute({
  ...POST_AGENDA_METHOD,
  path: '/agendas/{id}/file',
  summary: 'Unggah berkas laporan agenda',
  request: {
    params: IdParamSchema,
    body: { content: { 'multipart/form-data': { schema: UploadAgendaFileSchema } } },
  },
  responses: {
    ...okResponse(AgendaFileResponseSchema, 'Berkas tersimpan', 'AgendaFileResponse'),
    ...errors([401, 404], { 403: 'Bukan pemilik' }),
  },
});

agendaRoutes.openapi(listAgendasRoute, async (c) => {
  const query = c.req.valid('query');
  const user = actor(c);
  const scopedUserId = query.user_id ?? (seesAll(user) ? undefined : Number(user.id));
  const result = await domain.listAgendas({
    userId: scopedUserId,
    year: query.year,
    month: query.month,
    search: query.search,
    page: query.page,
    perPage: query.per_page,
  });
  return c.json(successBody(result, 'Daftar agenda'), 200);
});

agendaRoutes.openapi(createAgendaRoute, async (c) => {
  const body = c.req.valid('json');
  const result = await domain.createAgenda(body, actor(c));
  return c.json(successBody(result, 'Agenda dibuat'), 200);
});

agendaRoutes.openapi(getAgendaRoute, async (c) => {
  const { id } = c.req.valid('param');
  const detail = await domain.getAgendaDetail(id);
  if (!domain.canViewAgenda(actor(c), detail)) {
    throw badRequest('Tidak berhak melihat agenda milik pegawai lain');
  }
  return c.json(successBody(detail, 'Detail agenda'), 200);
});

agendaRoutes.openapi(updateAgendaRoute, async (c) => {
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const result = await domain.updateAgendaById(id, body, actor(c));
  return c.json(successBody(result, 'Agenda diperbarui'), 200);
});

agendaRoutes.openapi(deleteAgendaRoute, async (c) => {
  const { id } = c.req.valid('param');
  await domain.removeAgenda(id, actor(c));
  return c.json(successBody(null, 'Agenda dihapus'), 200);
});

agendaRoutes.openapi(setAgendaReportRoute, async (c) => {
  const id = Number(c.req.param('id'));
  const body = c.req.valid('json');
  const result = await domain.setAgendaReportById(id, body.report, actor(c));
  return c.json(successBody(result, 'Laporan tersimpan'), 200);
});

agendaRoutes.openapi(uploadAgendaFileRoute, async (c) => {
  const id = Number(c.req.param('id'));
  const form = await c.req.parseBody();
  const file = form.file;
  if (!(file instanceof File)) throw badRequest('Berkas wajib dilampirkan');
  const result = await domain.attachAgendaFile(
    id,
    {
      buffer: Buffer.from(await file.arrayBuffer()),
      filename: file.name || 'berkas',
      mimeType: file.type || null,
    },
    actor(c),
  );
  return c.json(successBody(result, 'Berkas agenda tersimpan'), 200);
});
