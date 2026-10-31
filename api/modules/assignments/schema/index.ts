import { z } from 'zod';
import { createRoute } from '@hono/zod-openapi';
import {
  AssignmentLetterSchema,
  errorResponses,
  json,
  ok,
} from './shared';

/**
 * Schema request/response + definisi route modul surat tugas.
 * Cerminan legacy `surattugas/*.php`: surat + anggota + keterangan + tembusan,
 * approval current-state (hlm_surtug_acc dilipat ke entity), penomoran manual
 * setelah disetujui (`surtug_input_nomor.php`), dan unggah berkas
 * (`upload_surtug.php`).
 */

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD');

export const AssignmentLetterInputSchema = z
  .object({
    user_id: z.coerce.number().int().positive().optional(),
    code: z.string().max(50).optional(),
    consideration: z.string().max(8000).optional(),
    legal_basis: z.string().max(8000).optional(),
    content: z.string().max(8000).optional(),
    start_date: DateSchema.optional(),
    end_date: DateSchema.optional(),
    day_start: z.string().max(30).optional(),
    day_end: z.string().max(30).optional(),
    place: z.string().max(150).optional(),
    time_start: z.string().max(10).optional(),
    time_end: z.string().max(10).optional(),
    signer_name: z.string().max(150).optional(),
    signer_position: z.string().max(150).optional(),
    footnote: z.string().max(4000).optional(),
  })
  .openapi('AssignmentLetterInput');

export const AssignmentLetterUpdateSchema = AssignmentLetterInputSchema.partial()
  .omit({ user_id: true })
  .openapi('AssignmentLetterUpdate');

export const AssignmentMemberInputSchema = z
  .object({
    name: z.string().min(1).max(150),
    nip: z.string().max(18).optional(),
    grade: z.string().max(20).optional(),
    position: z.string().max(150).optional(),
    organization_name: z.string().max(150).optional(),
    sort_order: z.coerce.number().int().optional(),
  })
  .openapi('AssignmentMemberInput');

export const AssignmentNoteInputSchema = z
  .object({
    note: z.string().min(1).max(8000),
    sort_order: z.coerce.number().int().optional(),
  })
  .openapi('AssignmentNoteInput');

export const AssignmentCopyInputSchema = z
  .object({
    copy_to: z.string().min(1).max(200),
    sort_order: z.coerce.number().int().optional(),
  })
  .openapi('AssignmentCopyInput');

export const AssignmentDecisionSchema = z
  .object({
    decision: z.enum(['accepted', 'rejected']),
    note: z.string().max(1000).optional(),
  })
  .openapi('AssignmentDecision');

export const AssignmentNumberSchema = z
  .object({ letter_number: z.string().min(1).max(100) })
  .openapi('AssignmentNumber');

const IdParamSchema = z.object({ id: z.coerce.number().int().positive() });
const MemberParamSchema = z.object({
  id: z.coerce.number().int().positive(),
  memberId: z.coerce.number().int().positive(),
});
const NoteParamSchema = z.object({
  id: z.coerce.number().int().positive(),
  noteId: z.coerce.number().int().positive(),
});
const CopyParamSchema = z.object({
  id: z.coerce.number().int().positive(),
  copyId: z.coerce.number().int().positive(),
});

export const listAssignmentLettersRoute = createRoute({
  method: 'get',
  path: '/assignment-letters',
  tags: ['Assignment Letters'],
  summary: 'Daftar surat tugas (cari nama/NIP/nomor/kode)',
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      user_id: z.coerce.number().int().positive().optional(),
      status: z.string().optional(),
      year: z.coerce.number().int().optional(),
      search: z.string().optional(),
      page: z.coerce.number().int().positive().optional(),
      per_page: z.coerce.number().int().positive().max(200).optional(),
    }),
  },
  responses: {
    200: {
      description: 'Daftar surat tugas',
      ...json(
        ok(
          z.object({
            items: z.array(AssignmentLetterSchema),
            total: z.number(),
            page: z.number(),
            per_page: z.number(),
            total_pages: z.number(),
          }),
          'AssignmentLetterListResponse',
        ),
      ),
    },
    ...errorResponses({ 401: 'Token tidak valid' }),
  },
});

export const createAssignmentLetterRoute = createRoute({
  method: 'post',
  path: '/assignment-letters',
  tags: ['Assignment Letters'],
  summary: 'Buat surat tugas',
  security: [{ bearerAuth: [] }],
  request: { body: json(AssignmentLetterInputSchema) },
  responses: {
    200: {
      description: 'Surat tugas dibuat',
      ...json(ok(z.record(z.any()), 'AssignmentLetterCreateResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 422: 'Validasi gagal' }),
  },
});

export const getAssignmentLetterRoute = createRoute({
  method: 'get',
  path: '/assignment-letters/{id}',
  tags: ['Assignment Letters'],
  summary: 'Detail surat tugas + anggota, keterangan, tembusan, berkas',
  security: [{ bearerAuth: [] }],
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: 'Detail surat tugas',
      ...json(ok(z.record(z.any()), 'AssignmentLetterDetailResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan pemilik', 404: 'Tidak ditemukan' }),
  },
});

export const updateAssignmentLetterRoute = createRoute({
  method: 'patch',
  path: '/assignment-letters/{id}',
  tags: ['Assignment Letters'],
  summary: 'Ubah header surat tugas',
  security: [{ bearerAuth: [] }],
  request: { params: IdParamSchema, body: json(AssignmentLetterUpdateSchema) },
  responses: {
    200: {
      description: 'Surat tugas diperbarui',
      ...json(ok(z.record(z.any()), 'AssignmentLetterUpdateResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan pemilik', 404: 'Tidak ditemukan' }),
  },
});

export const deleteAssignmentLetterRoute = createRoute({
  method: 'delete',
  path: '/assignment-letters/{id}',
  tags: ['Assignment Letters'],
  summary: 'Hapus surat tugas (bukan yang sudah disetujui)',
  security: [{ bearerAuth: [] }],
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: 'Surat tugas dihapus',
      ...json(ok(z.null(), 'AssignmentLetterDeleteResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan pemilik', 404: 'Tidak ditemukan' }),
  },
});

export const cancelAssignmentLetterRoute = createRoute({
  method: 'post',
  path: '/assignment-letters/{id}/cancel',
  tags: ['Assignment Letters'],
  summary: 'Batalkan surat tugas (pemilik/admin, belum disetujui)',
  security: [{ bearerAuth: [] }],
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: 'Surat tugas dibatalkan',
      ...json(ok(z.record(z.any()), 'AssignmentCancelResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan pemilik', 404: 'Tidak ditemukan' }),
  },
});

export const generateAssignmentPdfRoute = createRoute({
  method: 'post',
  path: '/assignment-letters/{id}/pdf',
  tags: ['Assignment Letters'],
  summary: 'Hasilkan PDF surat tugas + QR verifikasi (admin)',
  security: [{ bearerAuth: [] }],
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: 'PDF dibuat',
      ...json(ok(z.record(z.any()), 'AssignmentPdfResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan admin', 404: 'Tidak ditemukan' }),
  },
});

export const approveAssignmentLetterRoute = createRoute({
  method: 'post',
  path: '/assignment-letters/{id}/approve',
  tags: ['Assignment Letters'],
  summary: 'Setujui / tolak surat tugas (admin)',
  security: [{ bearerAuth: [] }],
  request: { params: IdParamSchema, body: json(AssignmentDecisionSchema) },
  responses: {
    200: {
      description: 'Keputusan tersimpan',
      ...json(ok(z.record(z.any()), 'AssignmentDecisionResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan admin', 404: 'Tidak ditemukan' }),
  },
});

export const setAssignmentNumberRoute = createRoute({
  method: 'post',
  path: '/assignment-letters/{id}/number',
  tags: ['Assignment Letters'],
  summary: 'Input nomor surat (admin, hanya setelah disetujui)',
  security: [{ bearerAuth: [] }],
  request: { params: IdParamSchema, body: json(AssignmentNumberSchema) },
  responses: {
    200: {
      description: 'Nomor tersimpan',
      ...json(ok(z.record(z.any()), 'AssignmentNumberResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan admin', 404: 'Tidak ditemukan' }),
  },
});

export const uploadAssignmentFileRoute = createRoute({
  method: 'post',
  path: '/assignment-letters/{id}/file',
  tags: ['Assignment Letters'],
  summary: 'Unggah berkas surat tugas bertanda tangan (admin)',
  security: [{ bearerAuth: [] }],
  request: {
    params: IdParamSchema,
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({ file: z.any() }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Berkas tersimpan',
      ...json(ok(z.record(z.any()), 'AssignmentFileResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan admin', 404: 'Tidak ditemukan' }),
  },
});

export const addAssignmentMemberRoute = createRoute({
  method: 'post',
  path: '/assignment-letters/{id}/members',
  tags: ['Assignment Members'],
  summary: 'Tambah anggota surat tugas',
  security: [{ bearerAuth: [] }],
  request: { params: IdParamSchema, body: json(AssignmentMemberInputSchema) },
  responses: {
    200: {
      description: 'Anggota ditambahkan',
      ...json(ok(z.record(z.any()), 'AssignmentMemberCreateResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan pemilik', 404: 'Tidak ditemukan' }),
  },
});

export const updateAssignmentMemberRoute = createRoute({
  method: 'patch',
  path: '/assignment-letters/{id}/members/{memberId}',
  tags: ['Assignment Members'],
  summary: 'Ubah anggota surat tugas',
  security: [{ bearerAuth: [] }],
  request: { params: MemberParamSchema, body: json(AssignmentMemberInputSchema.partial()) },
  responses: {
    200: {
      description: 'Anggota diperbarui',
      ...json(ok(z.record(z.any()), 'AssignmentMemberUpdateResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan pemilik', 404: 'Tidak ditemukan' }),
  },
});

export const deleteAssignmentMemberRoute = createRoute({
  method: 'delete',
  path: '/assignment-letters/{id}/members/{memberId}',
  tags: ['Assignment Members'],
  summary: 'Hapus anggota surat tugas',
  security: [{ bearerAuth: [] }],
  request: { params: MemberParamSchema },
  responses: {
    200: {
      description: 'Anggota dihapus',
      ...json(ok(z.null(), 'AssignmentMemberDeleteResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan pemilik', 404: 'Tidak ditemukan' }),
  },
});

export const addAssignmentNoteRoute = createRoute({
  method: 'post',
  path: '/assignment-letters/{id}/notes',
  tags: ['Assignment Notes'],
  summary: 'Tambah keterangan surat tugas',
  security: [{ bearerAuth: [] }],
  request: { params: IdParamSchema, body: json(AssignmentNoteInputSchema) },
  responses: {
    200: {
      description: 'Keterangan ditambahkan',
      ...json(ok(z.record(z.any()), 'AssignmentNoteCreateResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan pemilik', 404: 'Tidak ditemukan' }),
  },
});

export const updateAssignmentNoteRoute = createRoute({
  method: 'patch',
  path: '/assignment-letters/{id}/notes/{noteId}',
  tags: ['Assignment Notes'],
  summary: 'Ubah keterangan surat tugas',
  security: [{ bearerAuth: [] }],
  request: { params: NoteParamSchema, body: json(AssignmentNoteInputSchema.partial()) },
  responses: {
    200: {
      description: 'Keterangan diperbarui',
      ...json(ok(z.record(z.any()), 'AssignmentNoteUpdateResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan pemilik', 404: 'Tidak ditemukan' }),
  },
});

export const deleteAssignmentNoteRoute = createRoute({
  method: 'delete',
  path: '/assignment-letters/{id}/notes/{noteId}',
  tags: ['Assignment Notes'],
  summary: 'Hapus keterangan surat tugas',
  security: [{ bearerAuth: [] }],
  request: { params: NoteParamSchema },
  responses: {
    200: {
      description: 'Keterangan dihapus',
      ...json(ok(z.null(), 'AssignmentNoteDeleteResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan pemilik', 404: 'Tidak ditemukan' }),
  },
});

export const addAssignmentCopyRoute = createRoute({
  method: 'post',
  path: '/assignment-letters/{id}/copies',
  tags: ['Assignment Copies'],
  summary: 'Tambah tembusan surat tugas',
  security: [{ bearerAuth: [] }],
  request: { params: IdParamSchema, body: json(AssignmentCopyInputSchema) },
  responses: {
    200: {
      description: 'Tembusan ditambahkan',
      ...json(ok(z.record(z.any()), 'AssignmentCopyCreateResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan pemilik', 404: 'Tidak ditemukan' }),
  },
});

export const updateAssignmentCopyRoute = createRoute({
  method: 'patch',
  path: '/assignment-letters/{id}/copies/{copyId}',
  tags: ['Assignment Copies'],
  summary: 'Ubah tembusan surat tugas',
  security: [{ bearerAuth: [] }],
  request: { params: CopyParamSchema, body: json(AssignmentCopyInputSchema.partial()) },
  responses: {
    200: {
      description: 'Tembusan diperbarui',
      ...json(ok(z.record(z.any()), 'AssignmentCopyUpdateResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan pemilik', 404: 'Tidak ditemukan' }),
  },
});

export const deleteAssignmentCopyRoute = createRoute({
  method: 'delete',
  path: '/assignment-letters/{id}/copies/{copyId}',
  tags: ['Assignment Copies'],
  summary: 'Hapus tembusan surat tugas',
  security: [{ bearerAuth: [] }],
  request: { params: CopyParamSchema },
  responses: {
    200: {
      description: 'Tembusan dihapus',
      ...json(ok(z.null(), 'AssignmentCopyDeleteResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan pemilik', 404: 'Tidak ditemukan' }),
  },
});
