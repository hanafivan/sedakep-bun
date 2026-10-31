import { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { bearerAuth, type AuthUser } from '../../middleware/bearerAuth';
import { requireRole } from '../../middleware/roleGuard';
import { badRequest } from '../../shared/errors';
import { defaultHook } from '../../shared/openapi-hook';
import { successBody } from '../../shared/response';
import {
  addDispositionRoute,
  addFinalRoute,
  addReferenceRoute,
  createClassificationRoute,
  createIncomingLetterRoute,
  deleteClassificationRoute,
  deleteDispositionRoute,
  deleteFinalRoute,
  deleteIncomingLetterRoute,
  deleteReferenceRoute,
  finalizeIncomingLetterRoute,
  getIncomingLetterRoute,
  listClassificationsRoute,
  listIncomingLettersRoute,
  updateClassificationRoute,
  updateDispositionRoute,
  updateIncomingLetterRoute,
  uploadIncomingLetterFileRoute,
} from './schema';
import * as service from './service';

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

dispositionRoutes.openapi(listIncomingLettersRoute, async (c) => {
  const query = c.req.valid('query');
  const result = await service.listIncomingLetters({
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
  const result = await service.createIncomingLetter(body, actor(c));
  return c.json(successBody(result, 'Surat masuk dibuat'), 200);
});

dispositionRoutes.openapi(getIncomingLetterRoute, async (c) => {
  const { id } = c.req.valid('param');
  const detail = await service.getIncomingLetterDetail(id);
  return c.json(successBody(detail, 'Detail surat masuk'), 200);
});

dispositionRoutes.openapi(updateIncomingLetterRoute, async (c) => {
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const result = await service.updateIncomingLetterById(id, body, actor(c));
  return c.json(successBody(result, 'Surat masuk diperbarui'), 200);
});

dispositionRoutes.openapi(deleteIncomingLetterRoute, async (c) => {
  const { id } = c.req.valid('param');
  await service.removeIncomingLetter(id, actor(c));
  return c.json(successBody(null, 'Surat masuk dihapus'), 200);
});

dispositionRoutes.openapi(finalizeIncomingLetterRoute, async (c) => {
  const id = Number(c.req.param('id'));
  const result = await service.finalizeIncomingLetterById(id, actor(c));
  return c.json(successBody(result, 'Surat masuk difinalisasi'), 200);
});

dispositionRoutes.openapi(uploadIncomingLetterFileRoute, async (c) => {
  const id = Number(c.req.param('id'));
  const form = await c.req.parseBody();
  const file = form.file;
  if (!(file instanceof File)) throw badRequest('Berkas wajib dilampirkan');
  const field = typeof form.field === 'string' ? form.field : 'sm';
  const result = await service.attachIncomingLetterFile(
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
  const result = await service.addDisposition(id, body, actor(c));
  return c.json(successBody(result, 'Disposisi ditambahkan'), 200);
});

dispositionRoutes.openapi(updateDispositionRoute, async (c) => {
  const { id, childId } = c.req.valid('param');
  const body = c.req.valid('json');
  const result = await service.updateDispositionById(id, childId, body, actor(c));
  return c.json(successBody(result, 'Disposisi diperbarui'), 200);
});

dispositionRoutes.openapi(deleteDispositionRoute, async (c) => {
  const { id, childId } = c.req.valid('param');
  await service.removeDisposition(id, childId, actor(c));
  return c.json(successBody(null, 'Disposisi dihapus'), 200);
});

dispositionRoutes.openapi(addFinalRoute, async (c) => {
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const result = await service.addFinal(id, body, actor(c));
  return c.json(successBody(result, 'Final ditambahkan'), 200);
});

dispositionRoutes.openapi(deleteFinalRoute, async (c) => {
  const { id, childId } = c.req.valid('param');
  await service.removeFinal(id, childId, actor(c));
  return c.json(successBody(null, 'Final dihapus'), 200);
});

dispositionRoutes.openapi(addReferenceRoute, async (c) => {
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const result = await service.addReference(id, body.reference_text, actor(c));
  return c.json(successBody(result, 'Referensi ditambahkan'), 200);
});

dispositionRoutes.openapi(deleteReferenceRoute, async (c) => {
  const { id, childId } = c.req.valid('param');
  await service.removeReference(id, childId, actor(c));
  return c.json(successBody(null, 'Referensi dihapus'), 200);
});

dispositionRoutes.openapi(listClassificationsRoute, async (c) => {
  const query = c.req.valid('query');
  const items = await service.listClassifications({
    search: query.search,
    activeOnly: query.active_only === 'true' || query.active_only === '1',
  });
  return c.json(successBody(items, 'Daftar klasifikasi surat'), 200);
});

dispositionRoutes.openapi(createClassificationRoute, async (c) => {
  const body = c.req.valid('json');
  const result = await service.createClassification(body, actor(c));
  return c.json(successBody(result, 'Klasifikasi dibuat'), 200);
});

dispositionRoutes.openapi(updateClassificationRoute, async (c) => {
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const result = await service.updateClassificationById(id, body, actor(c));
  return c.json(successBody(result, 'Klasifikasi diperbarui'), 200);
});

dispositionRoutes.openapi(deleteClassificationRoute, async (c) => {
  const { id } = c.req.valid('param');
  await service.removeClassification(id, actor(c));
  return c.json(successBody(null, 'Klasifikasi dihapus'), 200);
});
