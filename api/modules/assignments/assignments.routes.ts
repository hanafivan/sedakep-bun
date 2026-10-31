import { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { bearerAuth, type AuthUser } from '../../middleware/bearerAuth';
import { requireRole } from '../../middleware/roleGuard';
import { badRequest } from '../../shared/errors';
import { defaultHook } from '../../shared/openapi-hook';
import { successBody } from '../../shared/response';
import {
  addAssignmentCopyRoute,
  addAssignmentMemberRoute,
  addAssignmentNoteRoute,
  approveAssignmentLetterRoute,
  cancelAssignmentLetterRoute,
  createAssignmentLetterRoute,
  deleteAssignmentCopyRoute,
  deleteAssignmentLetterRoute,
  deleteAssignmentMemberRoute,
  deleteAssignmentNoteRoute,
  generateAssignmentPdfRoute,
  getAssignmentLetterRoute,
  listAssignmentLettersRoute,
  setAssignmentNumberRoute,
  updateAssignmentCopyRoute,
  updateAssignmentLetterRoute,
  updateAssignmentMemberRoute,
  updateAssignmentNoteRoute,
  uploadAssignmentFileRoute,
} from './schema';
import * as service from './service';

/**
 * Route modul surat tugas — boundary HTTP saja.
 *
 * Semua endpoint wajib login. Middleware di-scope ke prefix modul ini supaya
 * `use('*')` tidak menelan seluruh API dan mengubah 404 menjadi 401.
 */

export const assignmentRoutes = new OpenAPIHono({ defaultHook });

for (const prefix of ['/assignment-letters', '/assignment-letters/*']) {
  assignmentRoutes.use(prefix, bearerAuth);
}

/** Approval, penomoran, dan unggah berkas surat hanya admin. */
for (const prefix of [
  '/assignment-letters/*/approve',
  '/assignment-letters/*/number',
  '/assignment-letters/*/file',
  '/assignment-letters/*/pdf',
]) {
  assignmentRoutes.use(prefix, requireRole('admin'));
}

const actor = (c: Context): AuthUser => c.get('user');
const seesAll = (user: AuthUser) =>
  user.role === 'admin' || user.role === 'verifikator' || user.role === 'atasan';

// ---------------------------------------------------------------------------
// Surat tugas
// ---------------------------------------------------------------------------

assignmentRoutes.openapi(listAssignmentLettersRoute, async (c) => {
  const query = c.req.valid('query');
  const user = actor(c);
  const scopedUserId = query.user_id ?? (seesAll(user) ? undefined : Number(user.id));

  const result = await service.listAssignmentLetters({
    userId: scopedUserId,
    status: query.status,
    year: query.year,
    search: query.search,
    page: query.page,
    perPage: query.per_page,
  });
  return c.json(successBody(result, 'Daftar surat tugas'), 200);
});

assignmentRoutes.openapi(createAssignmentLetterRoute, async (c) => {
  const body = c.req.valid('json');
  const user = actor(c);
  const requestedUserId = body.user_id ?? Number(user.id);
  const userId = user.role === 'admin' ? requestedUserId : Number(user.id);
  const result = await service.createAssignmentLetter({ ...body, user_id: userId }, user);
  return c.json(successBody(result, 'Surat tugas dibuat'), 200);
});

assignmentRoutes.openapi(getAssignmentLetterRoute, async (c) => {
  const { id } = c.req.valid('param');
  const detail = await service.getAssignmentLetterDetail(id);
  if (!service.canViewLetter(actor(c), detail)) {
    throw badRequest('Tidak berhak melihat surat tugas milik pegawai lain');
  }
  return c.json(successBody(detail, 'Detail surat tugas'), 200);
});

assignmentRoutes.openapi(updateAssignmentLetterRoute, async (c) => {
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const result = await service.updateAssignmentLetterById(id, body, actor(c));
  return c.json(successBody(result, 'Surat tugas diperbarui'), 200);
});

assignmentRoutes.openapi(deleteAssignmentLetterRoute, async (c) => {
  const { id } = c.req.valid('param');
  await service.removeAssignmentLetter(id, actor(c));
  return c.json(successBody(null, 'Surat tugas dihapus'), 200);
});

assignmentRoutes.openapi(cancelAssignmentLetterRoute, async (c) => {
  const id = Number(c.req.param('id'));
  const result = await service.cancelAssignmentLetter(id, actor(c));
  return c.json(successBody(result, 'Surat tugas dibatalkan'), 200);
});

assignmentRoutes.openapi(generateAssignmentPdfRoute, async (c) => {
  const id = Number(c.req.param('id'));
  const result = await service.generateAssignmentPdf(id, actor(c));
  return c.json(successBody(result, 'PDF surat tugas dibuat'), 200);
});

assignmentRoutes.openapi(approveAssignmentLetterRoute, async (c) => {
  const id = Number(c.req.param('id'));
  const body = c.req.valid('json');
  const result = await service.decideAssignmentLetter(id, body, actor(c));
  return c.json(successBody(result, 'Keputusan tersimpan'), 200);
});

assignmentRoutes.openapi(setAssignmentNumberRoute, async (c) => {
  const id = Number(c.req.param('id'));
  const body = c.req.valid('json');
  const result = await service.setAssignmentLetterNumber(id, body.letter_number, actor(c));
  return c.json(successBody(result, 'Nomor surat tersimpan'), 200);
});

assignmentRoutes.openapi(uploadAssignmentFileRoute, async (c) => {
  const id = Number(c.req.param('id'));
  const form = await c.req.parseBody();
  const file = form.file;
  if (!(file instanceof File)) throw badRequest('Berkas wajib dilampirkan');
  const result = await service.attachAssignmentFile(
    id,
    {
      buffer: Buffer.from(await file.arrayBuffer()),
      filename: file.name || 'berkas',
      mimeType: file.type || null,
    },
    actor(c),
  );
  return c.json(successBody(result, 'Berkas surat tugas tersimpan'), 200);
});

// ---------------------------------------------------------------------------
// Anggota
// ---------------------------------------------------------------------------

assignmentRoutes.openapi(addAssignmentMemberRoute, async (c) => {
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const result = await service.addAssignmentMember(id, body, actor(c));
  return c.json(successBody(result, 'Anggota ditambahkan'), 200);
});

assignmentRoutes.openapi(updateAssignmentMemberRoute, async (c) => {
  const { id, memberId } = c.req.valid('param');
  const body = c.req.valid('json');
  const result = await service.updateAssignmentMemberById(id, memberId, body, actor(c));
  return c.json(successBody(result, 'Anggota diperbarui'), 200);
});

assignmentRoutes.openapi(deleteAssignmentMemberRoute, async (c) => {
  const { id, memberId } = c.req.valid('param');
  await service.removeAssignmentMember(id, memberId, actor(c));
  return c.json(successBody(null, 'Anggota dihapus'), 200);
});

// ---------------------------------------------------------------------------
// Keterangan
// ---------------------------------------------------------------------------

assignmentRoutes.openapi(addAssignmentNoteRoute, async (c) => {
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const result = await service.addAssignmentNote(id, body, actor(c));
  return c.json(successBody(result, 'Keterangan ditambahkan'), 200);
});

assignmentRoutes.openapi(updateAssignmentNoteRoute, async (c) => {
  const { id, noteId } = c.req.valid('param');
  const body = c.req.valid('json');
  const result = await service.updateAssignmentNoteById(id, noteId, body, actor(c));
  return c.json(successBody(result, 'Keterangan diperbarui'), 200);
});

assignmentRoutes.openapi(deleteAssignmentNoteRoute, async (c) => {
  const { id, noteId } = c.req.valid('param');
  await service.removeAssignmentNote(id, noteId, actor(c));
  return c.json(successBody(null, 'Keterangan dihapus'), 200);
});

// ---------------------------------------------------------------------------
// Tembusan
// ---------------------------------------------------------------------------

assignmentRoutes.openapi(addAssignmentCopyRoute, async (c) => {
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const result = await service.addAssignmentCopy(id, body, actor(c));
  return c.json(successBody(result, 'Tembusan ditambahkan'), 200);
});

assignmentRoutes.openapi(updateAssignmentCopyRoute, async (c) => {
  const { id, copyId } = c.req.valid('param');
  const body = c.req.valid('json');
  const result = await service.updateAssignmentCopyById(id, copyId, body, actor(c));
  return c.json(successBody(result, 'Tembusan diperbarui'), 200);
});

assignmentRoutes.openapi(deleteAssignmentCopyRoute, async (c) => {
  const { id, copyId } = c.req.valid('param');
  await service.removeAssignmentCopy(id, copyId, actor(c));
  return c.json(successBody(null, 'Tembusan dihapus'), 200);
});
