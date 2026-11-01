import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { bearerAuth, type AuthUser } from '../../middleware/bearerAuth';
import { requireRole } from '../../middleware/roleGuard';
import { badRequest } from '../../shared/errors';
import { defaultHook } from '../../shared/openapi-hook';
import { errors, json, okResponse } from '../../shared/openapi';
import {
  DELETE_ASSIGNMENT_COPY_METHOD,
  DELETE_ASSIGNMENT_LETTER_METHOD,
  DELETE_ASSIGNMENT_MEMBER_METHOD,
  DELETE_ASSIGNMENT_NOTE_METHOD,
  GET_ASSIGNMENT_LETTER_METHOD,
  PATCH_ASSIGNMENT_COPY_METHOD,
  PATCH_ASSIGNMENT_LETTER_METHOD,
  PATCH_ASSIGNMENT_MEMBER_METHOD,
  PATCH_ASSIGNMENT_NOTE_METHOD,
  POST_ASSIGNMENT_COPY_METHOD,
  POST_ASSIGNMENT_LETTER_METHOD,
  POST_ASSIGNMENT_MEMBER_METHOD,
  POST_ASSIGNMENT_NOTE_METHOD,
} from '../../shared/constant';
import { successBody } from '../../shared/response';
import {
  AssignmentCancelResponseSchema,
  AssignmentCopyCreateResponseSchema,
  AssignmentCopyInputSchema,
  AssignmentCopyUpdateResponseSchema,
  AssignmentDecisionResponseSchema,
  AssignmentDecisionSchema,
  AssignmentFileResponseSchema,
  AssignmentLetterCreateResponseSchema,
  AssignmentLetterDetailResponseSchema,
  AssignmentLetterInputSchema,
  AssignmentLetterListResponseSchema,
  AssignmentLetterUpdateResponseSchema,
  AssignmentLetterUpdateSchema,
  AssignmentListQuerySchema,
  AssignmentMemberCreateResponseSchema,
  AssignmentMemberInputSchema,
  AssignmentMemberUpdateResponseSchema,
  AssignmentNoteCreateResponseSchema,
  AssignmentNoteInputSchema,
  AssignmentNoteUpdateResponseSchema,
  AssignmentNumberResponseSchema,
  AssignmentNumberSchema,
  AssignmentPdfResponseSchema,
  CopyParamSchema,
  IdParamSchema,
  MemberParamSchema,
  NoteParamSchema,
  UploadAssignmentFileSchema,
} from './schema';
import * as domain from './domain';

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

const listAssignmentLettersRoute = createRoute({
  ...GET_ASSIGNMENT_LETTER_METHOD,
  path: '/assignment-letters',
  summary: 'Daftar surat tugas (cari nama/NIP/nomor/kode)',
  request: {
    query: AssignmentListQuerySchema,
  },
  responses: {
    ...okResponse(AssignmentLetterListResponseSchema, 'Daftar surat tugas', 'AssignmentLetterListResponse'),
    ...errors([401]),
  },
});

const createAssignmentLetterRoute = createRoute({
  ...POST_ASSIGNMENT_LETTER_METHOD,
  path: '/assignment-letters',
  summary: 'Buat surat tugas',
  request: { body: json(AssignmentLetterInputSchema) },
  responses: {
    ...okResponse(AssignmentLetterCreateResponseSchema, 'Surat tugas dibuat', 'AssignmentLetterCreateResponse'),
    ...errors([401, 422]),
  },
});

const getAssignmentLetterRoute = createRoute({
  ...GET_ASSIGNMENT_LETTER_METHOD,
  path: '/assignment-letters/{id}',
  summary: 'Detail surat tugas + anggota, keterangan, tembusan, berkas',
  request: { params: IdParamSchema },
  responses: {
    ...okResponse(AssignmentLetterDetailResponseSchema, 'Detail surat tugas', 'AssignmentLetterDetailResponse'),
    ...errors([401, 404], { 403: 'Bukan pemilik' }),
  },
});

const updateAssignmentLetterRoute = createRoute({
  ...PATCH_ASSIGNMENT_LETTER_METHOD,
  path: '/assignment-letters/{id}',
  summary: 'Ubah header surat tugas',
  request: { params: IdParamSchema, body: json(AssignmentLetterUpdateSchema) },
  responses: {
    ...okResponse(AssignmentLetterUpdateResponseSchema, 'Surat tugas diperbarui', 'AssignmentLetterUpdateResponse'),
    ...errors([401, 404], { 403: 'Bukan pemilik' }),
  },
});

const deleteAssignmentLetterRoute = createRoute({
  ...DELETE_ASSIGNMENT_LETTER_METHOD,
  path: '/assignment-letters/{id}',
  summary: 'Hapus surat tugas (bukan yang sudah disetujui)',
  request: { params: IdParamSchema },
  responses: {
    ...okResponse(z.null(), 'Surat tugas dihapus', 'AssignmentLetterDeleteResponse'),
    ...errors([401, 404], { 403: 'Bukan pemilik' }),
  },
});

const cancelAssignmentLetterRoute = createRoute({
  ...POST_ASSIGNMENT_LETTER_METHOD,
  path: '/assignment-letters/{id}/cancel',
  summary: 'Batalkan surat tugas (pemilik/admin, belum disetujui)',
  request: { params: IdParamSchema },
  responses: {
    ...okResponse(AssignmentCancelResponseSchema, 'Surat tugas dibatalkan', 'AssignmentCancelResponse'),
    ...errors([401, 404], { 403: 'Bukan pemilik' }),
  },
});

const generateAssignmentPdfRoute = createRoute({
  ...POST_ASSIGNMENT_LETTER_METHOD,
  path: '/assignment-letters/{id}/pdf',
  summary: 'Hasilkan PDF surat tugas + QR verifikasi (admin)',
  request: { params: IdParamSchema },
  responses: {
    ...okResponse(AssignmentPdfResponseSchema, 'PDF dibuat', 'AssignmentPdfResponse'),
    ...errors([401, 404], { 403: 'Bukan admin' }),
  },
});

const approveAssignmentLetterRoute = createRoute({
  ...POST_ASSIGNMENT_LETTER_METHOD,
  path: '/assignment-letters/{id}/approve',
  summary: 'Setujui / tolak surat tugas (admin)',
  request: { params: IdParamSchema, body: json(AssignmentDecisionSchema) },
  responses: {
    ...okResponse(AssignmentDecisionResponseSchema, 'Keputusan tersimpan', 'AssignmentDecisionResponse'),
    ...errors([401, 404], { 403: 'Bukan admin' }),
  },
});

const setAssignmentNumberRoute = createRoute({
  ...POST_ASSIGNMENT_LETTER_METHOD,
  path: '/assignment-letters/{id}/number',
  summary: 'Input nomor surat (admin, hanya setelah disetujui)',
  request: { params: IdParamSchema, body: json(AssignmentNumberSchema) },
  responses: {
    ...okResponse(AssignmentNumberResponseSchema, 'Nomor tersimpan', 'AssignmentNumberResponse'),
    ...errors([401, 404], { 403: 'Bukan admin' }),
  },
});

const uploadAssignmentFileRoute = createRoute({
  ...POST_ASSIGNMENT_LETTER_METHOD,
  path: '/assignment-letters/{id}/file',
  summary: 'Unggah berkas surat tugas bertanda tangan (admin)',
  request: {
    params: IdParamSchema,
    body: {
      content: {
        'multipart/form-data': {
          schema: UploadAssignmentFileSchema,
        },
      },
    },
  },
  responses: {
    ...okResponse(AssignmentFileResponseSchema, 'Berkas tersimpan', 'AssignmentFileResponse'),
    ...errors([401, 404], { 403: 'Bukan admin' }),
  },
});

assignmentRoutes.openapi(listAssignmentLettersRoute, async (c) => {
  const query = c.req.valid('query');
  const user = actor(c);
  const scopedUserId = query.user_id ?? (seesAll(user) ? undefined : Number(user.id));

  const result = await domain.listAssignmentLetters({
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
  const result = await domain.createAssignmentLetter({ ...body, user_id: userId }, user);
  return c.json(successBody(result, 'Surat tugas dibuat'), 200);
});

assignmentRoutes.openapi(getAssignmentLetterRoute, async (c) => {
  const { id } = c.req.valid('param');
  const detail = await domain.getAssignmentLetterDetail(id);
  if (!domain.canViewLetter(actor(c), detail)) {
    throw badRequest('Tidak berhak melihat surat tugas milik pegawai lain');
  }
  return c.json(successBody(detail, 'Detail surat tugas'), 200);
});

assignmentRoutes.openapi(updateAssignmentLetterRoute, async (c) => {
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const result = await domain.updateAssignmentLetterById(id, body, actor(c));
  return c.json(successBody(result, 'Surat tugas diperbarui'), 200);
});

assignmentRoutes.openapi(deleteAssignmentLetterRoute, async (c) => {
  const { id } = c.req.valid('param');
  await domain.removeAssignmentLetter(id, actor(c));
  return c.json(successBody(null, 'Surat tugas dihapus'), 200);
});

assignmentRoutes.openapi(cancelAssignmentLetterRoute, async (c) => {
  const id = Number(c.req.param('id'));
  const result = await domain.cancelAssignmentLetter(id, actor(c));
  return c.json(successBody(result, 'Surat tugas dibatalkan'), 200);
});

assignmentRoutes.openapi(generateAssignmentPdfRoute, async (c) => {
  const id = Number(c.req.param('id'));
  const result = await domain.generateAssignmentPdf(id, actor(c));
  return c.json(successBody(result, 'PDF surat tugas dibuat'), 200);
});

assignmentRoutes.openapi(approveAssignmentLetterRoute, async (c) => {
  const id = Number(c.req.param('id'));
  const body = c.req.valid('json');
  const result = await domain.decideAssignmentLetter(id, body, actor(c));
  return c.json(successBody(result, 'Keputusan tersimpan'), 200);
});

assignmentRoutes.openapi(setAssignmentNumberRoute, async (c) => {
  const id = Number(c.req.param('id'));
  const body = c.req.valid('json');
  const result = await domain.setAssignmentLetterNumber(id, body.letter_number, actor(c));
  return c.json(successBody(result, 'Nomor surat tersimpan'), 200);
});

assignmentRoutes.openapi(uploadAssignmentFileRoute, async (c) => {
  const id = Number(c.req.param('id'));
  const form = await c.req.parseBody();
  const file = form.file;
  if (!(file instanceof File)) throw badRequest('Berkas wajib dilampirkan');
  const result = await domain.attachAssignmentFile(
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

const addAssignmentMemberRoute = createRoute({
  ...POST_ASSIGNMENT_MEMBER_METHOD,
  path: '/assignment-letters/{id}/members',
  summary: 'Tambah anggota surat tugas',
  request: { params: IdParamSchema, body: json(AssignmentMemberInputSchema) },
  responses: {
    ...okResponse(AssignmentMemberCreateResponseSchema, 'Anggota ditambahkan', 'AssignmentMemberCreateResponse'),
    ...errors([401, 404], { 403: 'Bukan pemilik' }),
  },
});

const updateAssignmentMemberRoute = createRoute({
  ...PATCH_ASSIGNMENT_MEMBER_METHOD,
  path: '/assignment-letters/{id}/members/{memberId}',
  summary: 'Ubah anggota surat tugas',
  request: { params: MemberParamSchema, body: json(AssignmentMemberInputSchema.partial()) },
  responses: {
    ...okResponse(AssignmentMemberUpdateResponseSchema, 'Anggota diperbarui', 'AssignmentMemberUpdateResponse'),
    ...errors([401, 404], { 403: 'Bukan pemilik' }),
  },
});

const deleteAssignmentMemberRoute = createRoute({
  ...DELETE_ASSIGNMENT_MEMBER_METHOD,
  path: '/assignment-letters/{id}/members/{memberId}',
  summary: 'Hapus anggota surat tugas',
  request: { params: MemberParamSchema },
  responses: {
    ...okResponse(z.null(), 'Anggota dihapus', 'AssignmentMemberDeleteResponse'),
    ...errors([401, 404], { 403: 'Bukan pemilik' }),
  },
});

assignmentRoutes.openapi(addAssignmentMemberRoute, async (c) => {
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const result = await domain.addAssignmentMember(id, body, actor(c));
  return c.json(successBody(result, 'Anggota ditambahkan'), 200);
});

assignmentRoutes.openapi(updateAssignmentMemberRoute, async (c) => {
  const { id, memberId } = c.req.valid('param');
  const body = c.req.valid('json');
  const result = await domain.updateAssignmentMemberById(id, memberId, body, actor(c));
  return c.json(successBody(result, 'Anggota diperbarui'), 200);
});

assignmentRoutes.openapi(deleteAssignmentMemberRoute, async (c) => {
  const { id, memberId } = c.req.valid('param');
  await domain.removeAssignmentMember(id, memberId, actor(c));
  return c.json(successBody(null, 'Anggota dihapus'), 200);
});

// ---------------------------------------------------------------------------
// Keterangan
// ---------------------------------------------------------------------------

const addAssignmentNoteRoute = createRoute({
  ...POST_ASSIGNMENT_NOTE_METHOD,
  path: '/assignment-letters/{id}/notes',
  summary: 'Tambah keterangan surat tugas',
  request: { params: IdParamSchema, body: json(AssignmentNoteInputSchema) },
  responses: {
    ...okResponse(AssignmentNoteCreateResponseSchema, 'Keterangan ditambahkan', 'AssignmentNoteCreateResponse'),
    ...errors([401, 404], { 403: 'Bukan pemilik' }),
  },
});

const updateAssignmentNoteRoute = createRoute({
  ...PATCH_ASSIGNMENT_NOTE_METHOD,
  path: '/assignment-letters/{id}/notes/{noteId}',
  summary: 'Ubah keterangan surat tugas',
  request: { params: NoteParamSchema, body: json(AssignmentNoteInputSchema.partial()) },
  responses: {
    ...okResponse(AssignmentNoteUpdateResponseSchema, 'Keterangan diperbarui', 'AssignmentNoteUpdateResponse'),
    ...errors([401, 404], { 403: 'Bukan pemilik' }),
  },
});

const deleteAssignmentNoteRoute = createRoute({
  ...DELETE_ASSIGNMENT_NOTE_METHOD,
  path: '/assignment-letters/{id}/notes/{noteId}',
  summary: 'Hapus keterangan surat tugas',
  request: { params: NoteParamSchema },
  responses: {
    ...okResponse(z.null(), 'Keterangan dihapus', 'AssignmentNoteDeleteResponse'),
    ...errors([401, 404], { 403: 'Bukan pemilik' }),
  },
});

assignmentRoutes.openapi(addAssignmentNoteRoute, async (c) => {
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const result = await domain.addAssignmentNote(id, body, actor(c));
  return c.json(successBody(result, 'Keterangan ditambahkan'), 200);
});

assignmentRoutes.openapi(updateAssignmentNoteRoute, async (c) => {
  const { id, noteId } = c.req.valid('param');
  const body = c.req.valid('json');
  const result = await domain.updateAssignmentNoteById(id, noteId, body, actor(c));
  return c.json(successBody(result, 'Keterangan diperbarui'), 200);
});

assignmentRoutes.openapi(deleteAssignmentNoteRoute, async (c) => {
  const { id, noteId } = c.req.valid('param');
  await domain.removeAssignmentNote(id, noteId, actor(c));
  return c.json(successBody(null, 'Keterangan dihapus'), 200);
});

// ---------------------------------------------------------------------------
// Tembusan
// ---------------------------------------------------------------------------

const addAssignmentCopyRoute = createRoute({
  ...POST_ASSIGNMENT_COPY_METHOD,
  path: '/assignment-letters/{id}/copies',
  summary: 'Tambah tembusan surat tugas',
  request: { params: IdParamSchema, body: json(AssignmentCopyInputSchema) },
  responses: {
    ...okResponse(AssignmentCopyCreateResponseSchema, 'Tembusan ditambahkan', 'AssignmentCopyCreateResponse'),
    ...errors([401, 404], { 403: 'Bukan pemilik' }),
  },
});

const updateAssignmentCopyRoute = createRoute({
  ...PATCH_ASSIGNMENT_COPY_METHOD,
  path: '/assignment-letters/{id}/copies/{copyId}',
  summary: 'Ubah tembusan surat tugas',
  request: { params: CopyParamSchema, body: json(AssignmentCopyInputSchema.partial()) },
  responses: {
    ...okResponse(AssignmentCopyUpdateResponseSchema, 'Tembusan diperbarui', 'AssignmentCopyUpdateResponse'),
    ...errors([401, 404], { 403: 'Bukan pemilik' }),
  },
});

const deleteAssignmentCopyRoute = createRoute({
  ...DELETE_ASSIGNMENT_COPY_METHOD,
  path: '/assignment-letters/{id}/copies/{copyId}',
  summary: 'Hapus tembusan surat tugas',
  request: { params: CopyParamSchema },
  responses: {
    ...okResponse(z.null(), 'Tembusan dihapus', 'AssignmentCopyDeleteResponse'),
    ...errors([401, 404], { 403: 'Bukan pemilik' }),
  },
});

assignmentRoutes.openapi(addAssignmentCopyRoute, async (c) => {
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const result = await domain.addAssignmentCopy(id, body, actor(c));
  return c.json(successBody(result, 'Tembusan ditambahkan'), 200);
});

assignmentRoutes.openapi(updateAssignmentCopyRoute, async (c) => {
  const { id, copyId } = c.req.valid('param');
  const body = c.req.valid('json');
  const result = await domain.updateAssignmentCopyById(id, copyId, body, actor(c));
  return c.json(successBody(result, 'Tembusan diperbarui'), 200);
});

assignmentRoutes.openapi(deleteAssignmentCopyRoute, async (c) => {
  const { id, copyId } = c.req.valid('param');
  await domain.removeAssignmentCopy(id, copyId, actor(c));
  return c.json(successBody(null, 'Tembusan dihapus'), 200);
});
