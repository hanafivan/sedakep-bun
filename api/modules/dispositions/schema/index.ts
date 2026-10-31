import { z } from 'zod';
import { createRoute } from '@hono/zod-openapi';
import {
  IncomingLetterSchema,
  LetterClassificationSchema,
  errorResponses,
  json,
  ok,
} from './shared';

/**
 * Route modul disposisi (surat masuk umum). Cerminan legacy `disposisi/*.php`:
 * surat masuk, klasifikasi, disposisi ke pelaksana, referensi, finalisasi, dan
 * unggah berkas (file surat masuk + berkas SK).
 */

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD');
const IdParamSchema = z.object({ id: z.coerce.number().int().positive() });
const ChildParamSchema = z.object({
  id: z.coerce.number().int().positive(),
  childId: z.coerce.number().int().positive(),
});

export const IncomingLetterInputSchema = z
  .object({
    owner_name: z.string().max(120).optional(),
    owner_nip: z.string().max(18).optional(),
    agenda_number: z.string().max(50).optional(),
    ticket_number: z.string().max(50).optional(),
    letter_number: z.string().max(100).optional(),
    origin: z.string().max(200).optional(),
    content: z.string().max(20000).optional(),
    classification_code: z.string().max(50).optional(),
    index_code: z.string().max(50).optional(),
    letter_date: DateSchema.optional(),
    received_date: DateSchema.optional(),
    notes: z.string().max(2000).optional(),
  })
  .openapi('IncomingLetterInput');

export const IncomingLetterUpdateSchema = IncomingLetterInputSchema.partial().openapi(
  'IncomingLetterUpdate',
);

export const DispositionInputSchema = z
  .object({
    target_name: z.string().max(150).optional(),
    target_nip: z.string().max(18).optional(),
    instruction: z.string().max(8000).optional(),
    notes: z.string().max(2000).optional(),
    sort_order: z.coerce.number().int().optional(),
  })
  .openapi('DispositionInput');

export const DispositionUpdateSchema = DispositionInputSchema.partial()
  .extend({ status: z.enum(['pending', 'accepted', 'done', 'rejected']).optional() })
  .openapi('DispositionUpdate');

export const DispositionFinalInputSchema = z
  .object({
    name: z.string().max(150).optional(),
    nip: z.string().max(18).optional(),
    instruction: z.string().max(8000).optional(),
  })
  .openapi('DispositionFinalInput');

export const ReferenceInputSchema = z
  .object({ reference_text: z.string().min(1).max(255) })
  .openapi('IncomingLetterReferenceInput');

export const ClassificationInputSchema = z
  .object({
    code: z.string().min(1).max(50),
    name: z.string().min(1).max(200),
    description: z.string().max(4000).optional(),
    is_active: z.boolean().optional(),
  })
  .openapi('LetterClassificationInput');

// ---------------------------------------------------------------------------
// Surat masuk
// ---------------------------------------------------------------------------

export const listIncomingLettersRoute = createRoute({
  method: 'get',
  path: '/incoming-letters',
  tags: ['Dispositions'],
  summary: 'Daftar surat masuk (cari nomor/asal/agenda)',
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      status: z.string().optional(),
      year: z.coerce.number().int().optional(),
      search: z.string().optional(),
      page: z.coerce.number().int().positive().optional(),
      per_page: z.coerce.number().int().positive().max(200).optional(),
    }),
  },
  responses: {
    200: {
      description: 'Daftar surat masuk',
      ...json(
        ok(
          z.object({
            items: z.array(IncomingLetterSchema),
            total: z.number(),
            page: z.number(),
            per_page: z.number(),
            total_pages: z.number(),
          }),
          'IncomingLetterListResponse',
        ),
      ),
    },
    ...errorResponses({ 401: 'Token tidak valid' }),
  },
});

export const createIncomingLetterRoute = createRoute({
  method: 'post',
  path: '/incoming-letters',
  tags: ['Dispositions'],
  summary: 'Catat surat masuk',
  security: [{ bearerAuth: [] }],
  request: { body: json(IncomingLetterInputSchema) },
  responses: {
    200: {
      description: 'Surat masuk dibuat',
      ...json(ok(z.record(z.any()), 'IncomingLetterCreateResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 422: 'Validasi gagal' }),
  },
});

export const getIncomingLetterRoute = createRoute({
  method: 'get',
  path: '/incoming-letters/{id}',
  tags: ['Dispositions'],
  summary: 'Detail surat masuk + disposisi, final, referensi, berkas',
  security: [{ bearerAuth: [] }],
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: 'Detail surat masuk',
      ...json(ok(z.record(z.any()), 'IncomingLetterDetailResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 404: 'Tidak ditemukan' }),
  },
});

export const updateIncomingLetterRoute = createRoute({
  method: 'patch',
  path: '/incoming-letters/{id}',
  tags: ['Dispositions'],
  summary: 'Ubah surat masuk',
  security: [{ bearerAuth: [] }],
  request: { params: IdParamSchema, body: json(IncomingLetterUpdateSchema) },
  responses: {
    200: {
      description: 'Surat masuk diperbarui',
      ...json(ok(z.record(z.any()), 'IncomingLetterUpdateResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 404: 'Tidak ditemukan' }),
  },
});

export const deleteIncomingLetterRoute = createRoute({
  method: 'delete',
  path: '/incoming-letters/{id}',
  tags: ['Dispositions'],
  summary: 'Hapus surat masuk',
  security: [{ bearerAuth: [] }],
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: 'Surat masuk dihapus',
      ...json(ok(z.null(), 'IncomingLetterDeleteResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 404: 'Tidak ditemukan' }),
  },
});

export const finalizeIncomingLetterRoute = createRoute({
  method: 'post',
  path: '/incoming-letters/{id}/finalize',
  tags: ['Dispositions'],
  summary: 'Finalisasi surat masuk (set status selesai)',
  security: [{ bearerAuth: [] }],
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: 'Surat difinalisasi',
      ...json(ok(z.record(z.any()), 'IncomingLetterFinalizeResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 404: 'Tidak ditemukan' }),
  },
});

export const uploadIncomingLetterFileRoute = createRoute({
  method: 'post',
  path: '/incoming-letters/{id}/file',
  tags: ['Dispositions'],
  summary: 'Unggah berkas surat masuk / SK',
  security: [{ bearerAuth: [] }],
  request: {
    params: IdParamSchema,
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({ file: z.any(), field: z.string().optional() }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Berkas tersimpan',
      ...json(ok(z.record(z.any()), 'IncomingLetterFileResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 404: 'Tidak ditemukan' }),
  },
});

// ---------------------------------------------------------------------------
// Disposisi (pelaksana)
// ---------------------------------------------------------------------------

export const addDispositionRoute = createRoute({
  method: 'post',
  path: '/incoming-letters/{id}/dispositions',
  tags: ['Dispositions'],
  summary: 'Tambah disposisi/pelaksana',
  security: [{ bearerAuth: [] }],
  request: { params: IdParamSchema, body: json(DispositionInputSchema) },
  responses: {
    200: {
      description: 'Disposisi ditambahkan',
      ...json(ok(z.record(z.any()), 'DispositionCreateResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 404: 'Tidak ditemukan' }),
  },
});

export const updateDispositionRoute = createRoute({
  method: 'patch',
  path: '/incoming-letters/{id}/dispositions/{childId}',
  tags: ['Dispositions'],
  summary: 'Ubah status/data disposisi',
  security: [{ bearerAuth: [] }],
  request: { params: ChildParamSchema, body: json(DispositionUpdateSchema) },
  responses: {
    200: {
      description: 'Disposisi diperbarui',
      ...json(ok(z.record(z.any()), 'DispositionUpdateResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 404: 'Tidak ditemukan' }),
  },
});

export const deleteDispositionRoute = createRoute({
  method: 'delete',
  path: '/incoming-letters/{id}/dispositions/{childId}',
  tags: ['Dispositions'],
  summary: 'Hapus disposisi',
  security: [{ bearerAuth: [] }],
  request: { params: ChildParamSchema },
  responses: {
    200: {
      description: 'Disposisi dihapus',
      ...json(ok(z.null(), 'DispositionDeleteResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 404: 'Tidak ditemukan' }),
  },
});

// ---------------------------------------------------------------------------
// Final & referensi
// ---------------------------------------------------------------------------

export const addFinalRoute = createRoute({
  method: 'post',
  path: '/incoming-letters/{id}/finals',
  tags: ['Dispositions'],
  summary: 'Tambah baris final',
  security: [{ bearerAuth: [] }],
  request: { params: IdParamSchema, body: json(DispositionFinalInputSchema) },
  responses: {
    200: {
      description: 'Final ditambahkan',
      ...json(ok(z.record(z.any()), 'DispositionFinalCreateResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 404: 'Tidak ditemukan' }),
  },
});

export const deleteFinalRoute = createRoute({
  method: 'delete',
  path: '/incoming-letters/{id}/finals/{childId}',
  tags: ['Dispositions'],
  summary: 'Hapus baris final',
  security: [{ bearerAuth: [] }],
  request: { params: ChildParamSchema },
  responses: {
    200: {
      description: 'Final dihapus',
      ...json(ok(z.null(), 'DispositionFinalDeleteResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 404: 'Tidak ditemukan' }),
  },
});

export const addReferenceRoute = createRoute({
  method: 'post',
  path: '/incoming-letters/{id}/references',
  tags: ['Dispositions'],
  summary: 'Tambah referensi surat',
  security: [{ bearerAuth: [] }],
  request: { params: IdParamSchema, body: json(ReferenceInputSchema) },
  responses: {
    200: {
      description: 'Referensi ditambahkan',
      ...json(ok(z.record(z.any()), 'ReferenceCreateResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 404: 'Tidak ditemukan' }),
  },
});

export const deleteReferenceRoute = createRoute({
  method: 'delete',
  path: '/incoming-letters/{id}/references/{childId}',
  tags: ['Dispositions'],
  summary: 'Hapus referensi surat',
  security: [{ bearerAuth: [] }],
  request: { params: ChildParamSchema },
  responses: {
    200: {
      description: 'Referensi dihapus',
      ...json(ok(z.null(), 'ReferenceDeleteResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 404: 'Tidak ditemukan' }),
  },
});

// ---------------------------------------------------------------------------
// Klasifikasi surat
// ---------------------------------------------------------------------------

export const listClassificationsRoute = createRoute({
  method: 'get',
  path: '/letter-classifications',
  tags: ['Dispositions'],
  summary: 'Daftar klasifikasi surat',
  security: [{ bearerAuth: [] }],
  request: { query: z.object({ search: z.string().optional(), active_only: z.string().optional() }) },
  responses: {
    200: {
      description: 'Daftar klasifikasi',
      ...json(ok(z.array(LetterClassificationSchema), 'ClassificationListResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid' }),
  },
});

export const createClassificationRoute = createRoute({
  method: 'post',
  path: '/letter-classifications',
  tags: ['Dispositions'],
  summary: 'Tambah klasifikasi surat',
  security: [{ bearerAuth: [] }],
  request: { body: json(ClassificationInputSchema) },
  responses: {
    200: {
      description: 'Klasifikasi dibuat',
      ...json(ok(z.record(z.any()), 'ClassificationCreateResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 422: 'Validasi gagal' }),
  },
});

export const updateClassificationRoute = createRoute({
  method: 'patch',
  path: '/letter-classifications/{id}',
  tags: ['Dispositions'],
  summary: 'Ubah klasifikasi surat',
  security: [{ bearerAuth: [] }],
  request: { params: IdParamSchema, body: json(ClassificationInputSchema.partial()) },
  responses: {
    200: {
      description: 'Klasifikasi diperbarui',
      ...json(ok(z.record(z.any()), 'ClassificationUpdateResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 404: 'Tidak ditemukan' }),
  },
});

export const deleteClassificationRoute = createRoute({
  method: 'delete',
  path: '/letter-classifications/{id}',
  tags: ['Dispositions'],
  summary: 'Hapus klasifikasi surat',
  security: [{ bearerAuth: [] }],
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: 'Klasifikasi dihapus',
      ...json(ok(z.null(), 'ClassificationDeleteResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 404: 'Tidak ditemukan' }),
  },
});
