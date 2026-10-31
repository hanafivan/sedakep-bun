import { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { bearerAuth, type AuthUser } from '../../middleware/bearerAuth';
import { badRequest } from '../../shared/errors';
import { defaultHook } from '../../shared/openapi-hook';
import { successBody } from '../../shared/response';
import {
  createAgendaRoute,
  deleteAgendaRoute,
  getAgendaRoute,
  listAgendasRoute,
  setAgendaReportRoute,
  updateAgendaRoute,
  uploadAgendaFileRoute,
} from './schema';
import * as service from './service';

/** Route modul agenda — boundary HTTP saja. */

export const agendaRoutes = new OpenAPIHono({ defaultHook });

for (const prefix of ['/agendas', '/agendas/*']) {
  agendaRoutes.use(prefix, bearerAuth);
}

const actor = (c: Context): AuthUser => c.get('user');
const seesAll = (user: AuthUser) =>
  user.role === 'admin' || user.role === 'verifikator' || user.role === 'atasan';

agendaRoutes.openapi(listAgendasRoute, async (c) => {
  const query = c.req.valid('query');
  const user = actor(c);
  const scopedUserId = query.user_id ?? (seesAll(user) ? undefined : Number(user.id));
  const result = await service.listAgendas({
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
  const result = await service.createAgenda(body, actor(c));
  return c.json(successBody(result, 'Agenda dibuat'), 200);
});

agendaRoutes.openapi(getAgendaRoute, async (c) => {
  const { id } = c.req.valid('param');
  const detail = await service.getAgendaDetail(id);
  if (!service.canViewAgenda(actor(c), detail)) {
    throw badRequest('Tidak berhak melihat agenda milik pegawai lain');
  }
  return c.json(successBody(detail, 'Detail agenda'), 200);
});

agendaRoutes.openapi(updateAgendaRoute, async (c) => {
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const result = await service.updateAgendaById(id, body, actor(c));
  return c.json(successBody(result, 'Agenda diperbarui'), 200);
});

agendaRoutes.openapi(deleteAgendaRoute, async (c) => {
  const { id } = c.req.valid('param');
  await service.removeAgenda(id, actor(c));
  return c.json(successBody(null, 'Agenda dihapus'), 200);
});

agendaRoutes.openapi(setAgendaReportRoute, async (c) => {
  const id = Number(c.req.param('id'));
  const body = c.req.valid('json');
  const result = await service.setAgendaReportById(id, body.report, actor(c));
  return c.json(successBody(result, 'Laporan tersimpan'), 200);
});

agendaRoutes.openapi(uploadAgendaFileRoute, async (c) => {
  const id = Number(c.req.param('id'));
  const form = await c.req.parseBody();
  const file = form.file;
  if (!(file instanceof File)) throw badRequest('Berkas wajib dilampirkan');
  const result = await service.attachAgendaFile(
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
