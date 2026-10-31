import { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { bearerAuth, type AuthUser } from '../../middleware/bearerAuth';
import { requireRole } from '../../middleware/roleGuard';
import { badRequest } from '../../shared/errors';
import { defaultHook } from '../../shared/openapi-hook';
import { successBody } from '../../shared/response';
import {
  addGeneratedLetterRoute,
  addServiceCheckRoute,
  approveServiceRequestRoute,
  createServiceRequestRoute,
  deleteServiceRequestRoute,
  generateServicePdfRoute,
  getServiceRequestRoute,
  listServiceRequestsRoute,
  serviceMetaRoute,
  setServiceFieldsRoute,
  updateServiceRequestRoute,
  uploadServiceDocumentRoute,
} from './schema';
import * as service from './service';

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

serviceRequestRoutes.openapi(serviceMetaRoute, async (c) => {
  return c.json(successBody(service.getServiceMeta(), 'Metadata layanan'), 200);
});

serviceRequestRoutes.openapi(listServiceRequestsRoute, async (c) => {
  const query = c.req.valid('query');
  const user = actor(c);
  const scopedUserId = query.user_id ?? (seesAll(user) ? undefined : Number(user.id));
  const result = await service.listServiceRequests({
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
  const result = await service.createServiceRequest({ ...body, user_id: userId }, user);
  return c.json(successBody(result, 'Permohonan layanan dibuat'), 200);
});

serviceRequestRoutes.openapi(getServiceRequestRoute, async (c) => {
  const { id } = c.req.valid('param');
  const detail = await service.getServiceRequestDetail(id);
  if (!service.canViewService(actor(c), detail)) {
    throw badRequest('Tidak berhak melihat permohonan milik pegawai lain');
  }
  return c.json(successBody(detail, 'Detail permohonan layanan'), 200);
});

serviceRequestRoutes.openapi(updateServiceRequestRoute, async (c) => {
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const result = await service.updateServiceRequestById(id, body, actor(c));
  return c.json(successBody(result, 'Permohonan layanan diperbarui'), 200);
});

serviceRequestRoutes.openapi(deleteServiceRequestRoute, async (c) => {
  const { id } = c.req.valid('param');
  await service.removeServiceRequest(id, actor(c));
  return c.json(successBody(null, 'Permohonan layanan dihapus'), 200);
});

serviceRequestRoutes.openapi(generateServicePdfRoute, async (c) => {
  const id = Number(c.req.param('id'));
  const result = await service.generateServiceLetterPdf(id, actor(c));
  return c.json(successBody(result, 'PDF surat layanan dibuat'), 200);
});

serviceRequestRoutes.openapi(approveServiceRequestRoute, async (c) => {
  const id = Number(c.req.param('id'));
  const body = c.req.valid('json');
  const result = await service.decideServiceRequest(id, body, actor(c));
  return c.json(successBody(result, 'Keputusan tersimpan'), 200);
});

serviceRequestRoutes.openapi(setServiceFieldsRoute, async (c) => {
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const result = await service.setServiceFields(id, body.fields, actor(c));
  return c.json(successBody(result, 'Field tersimpan'), 200);
});

serviceRequestRoutes.openapi(uploadServiceDocumentRoute, async (c) => {
  const id = Number(c.req.param('id'));
  const form = await c.req.parseBody();
  const file = form.file;
  const label = form.label;
  if (!(file instanceof File)) throw badRequest('Berkas wajib dilampirkan');
  if (typeof label !== 'string' || !label) throw badRequest('Label dokumen wajib diisi');
  const result = await service.attachServiceDocument(
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
  const result = await service.addServiceCheck(id, body, actor(c));
  return c.json(successBody(result, 'Verifikasi tersimpan'), 200);
});

serviceRequestRoutes.openapi(addGeneratedLetterRoute, async (c) => {
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const result = await service.addGeneratedLetter(id, body, actor(c));
  return c.json(successBody(result, 'Surat dicatat'), 200);
});
