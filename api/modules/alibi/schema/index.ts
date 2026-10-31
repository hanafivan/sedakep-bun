import { z } from 'zod';
import { createRoute } from '@hono/zod-openapi';
import { AlibiRequestSchema, errorResponses, json, ok } from './shared';

/**
 * Route modul alibi. Cerminan legacy `alibi/*.php`: pengajuan alibi dengan
 * approval admin → atasan 1 → atasan 2 (nilai Diterima/Ditolak) dan unggah
 * berkas (`upload_alibi.php`).
 */

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD');

export const AlibiInputSchema = z
  .object({
    user_id: z.coerce.number().int().positive().optional(),
    day_count: z.string().max(20).optional(),
    alibi_date: DateSchema.optional(),
    alibi_type: z.string().max(50).optional(),
    reason: z.string().max(1000).optional(),
    time_start: z.string().max(10).optional(),
    time_end: z.string().max(10).optional(),
    approver_1_name: z.string().max(150).optional(),
    approver_1_nip: z.string().max(18).optional(),
    approver_1_position: z.string().max(150).optional(),
    approver_2_name: z.string().max(150).optional(),
    approver_2_nip: z.string().max(18).optional(),
    approver_2_position: z.string().max(150).optional(),
  })
  .openapi('AlibiInput');

export const AlibiUpdateSchema = AlibiInputSchema.partial()
  .omit({ user_id: true })
  .openapi('AlibiUpdate');

export const AlibiAdminDecisionSchema = z
  .object({
    decision: z.enum(['accepted', 'rejected', 'cancelled']),
    note: z.string().max(1000).optional(),
  })
  .openapi('AlibiAdminDecision');

export const AlibiDecisionSchema = z
  .object({
    decision: z.enum(['accepted', 'rejected']),
    note: z.string().max(1000).optional(),
  })
  .openapi('AlibiDecision');

export const AlibiCancelSchema = z
  .object({ note: z.string().max(1000).optional() })
  .openapi('AlibiCancel');

const IdParamSchema = z.object({ id: z.coerce.number().int().positive() });
const LevelParamSchema = z.object({
  id: z.coerce.number().int().positive(),
  level: z.coerce.number().int().min(1).max(2),
});

export const listAlibiRequestsRoute = createRoute({
  method: 'get',
  path: '/alibi-requests',
  tags: ['Alibi'],
  summary: 'Daftar alibi (cari nama/NIP/jenis)',
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
      description: 'Daftar alibi',
      ...json(
        ok(
          z.object({
            items: z.array(AlibiRequestSchema),
            total: z.number(),
            page: z.number(),
            per_page: z.number(),
            total_pages: z.number(),
          }),
          'AlibiListResponse',
        ),
      ),
    },
    ...errorResponses({ 401: 'Token tidak valid' }),
  },
});

export const createAlibiRequestRoute = createRoute({
  method: 'post',
  path: '/alibi-requests',
  tags: ['Alibi'],
  summary: 'Ajukan alibi',
  security: [{ bearerAuth: [] }],
  request: { body: json(AlibiInputSchema) },
  responses: {
    200: {
      description: 'Alibi dibuat',
      ...json(ok(z.record(z.any()), 'AlibiCreateResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 422: 'Validasi gagal' }),
  },
});

export const getAlibiRequestRoute = createRoute({
  method: 'get',
  path: '/alibi-requests/{id}',
  tags: ['Alibi'],
  summary: 'Detail alibi + berkas',
  security: [{ bearerAuth: [] }],
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: 'Detail alibi',
      ...json(ok(z.record(z.any()), 'AlibiDetailResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan pemilik', 404: 'Tidak ditemukan' }),
  },
});

export const updateAlibiRequestRoute = createRoute({
  method: 'patch',
  path: '/alibi-requests/{id}',
  tags: ['Alibi'],
  summary: 'Ubah alibi (belum final)',
  security: [{ bearerAuth: [] }],
  request: { params: IdParamSchema, body: json(AlibiUpdateSchema) },
  responses: {
    200: {
      description: 'Alibi diperbarui',
      ...json(ok(z.record(z.any()), 'AlibiUpdateResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan pemilik', 404: 'Tidak ditemukan' }),
  },
});

export const deleteAlibiRequestRoute = createRoute({
  method: 'delete',
  path: '/alibi-requests/{id}',
  tags: ['Alibi'],
  summary: 'Hapus alibi (belum disetujui)',
  security: [{ bearerAuth: [] }],
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: 'Alibi dihapus',
      ...json(ok(z.null(), 'AlibiDeleteResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan pemilik', 404: 'Tidak ditemukan' }),
  },
});

export const approveAlibiAdminRoute = createRoute({
  method: 'post',
  path: '/alibi-requests/{id}/approve/admin',
  tags: ['Alibi'],
  summary: 'Keputusan admin (terima/tolak/batal)',
  security: [{ bearerAuth: [] }],
  request: { params: IdParamSchema, body: json(AlibiAdminDecisionSchema) },
  responses: {
    200: {
      description: 'Keputusan admin tersimpan',
      ...json(ok(z.record(z.any()), 'AlibiAdminDecisionResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan admin', 404: 'Tidak ditemukan' }),
  },
});

export const approveAlibiLevelRoute = createRoute({
  method: 'post',
  path: '/alibi-requests/{id}/approve/level/{level}',
  tags: ['Alibi'],
  summary: 'Keputusan atasan level 1/2',
  security: [{ bearerAuth: [] }],
  request: { params: LevelParamSchema, body: json(AlibiDecisionSchema) },
  responses: {
    200: {
      description: 'Keputusan atasan tersimpan',
      ...json(ok(z.record(z.any()), 'AlibiLevelDecisionResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan atasan', 404: 'Tidak ditemukan' }),
  },
});

export const cancelAlibiRoute = createRoute({
  method: 'post',
  path: '/alibi-requests/{id}/cancel',
  tags: ['Alibi'],
  summary: 'Batalkan alibi (pemilik/admin)',
  security: [{ bearerAuth: [] }],
  request: { params: IdParamSchema, body: json(AlibiCancelSchema) },
  responses: {
    200: {
      description: 'Alibi dibatalkan',
      ...json(ok(z.record(z.any()), 'AlibiCancelResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan pemilik', 404: 'Tidak ditemukan' }),
  },
});

export const uploadAlibiFileRoute = createRoute({
  method: 'post',
  path: '/alibi-requests/{id}/file',
  tags: ['Alibi'],
  summary: 'Unggah berkas alibi (admin/atasan)',
  security: [{ bearerAuth: [] }],
  request: {
    params: IdParamSchema,
    body: { content: { 'multipart/form-data': { schema: z.object({ file: z.any() }) } } },
  },
  responses: {
    200: {
      description: 'Berkas tersimpan',
      ...json(ok(z.record(z.any()), 'AlibiFileResponse')),
    },
    ...errorResponses({ 401: 'Token tidak valid', 403: 'Bukan admin/atasan', 404: 'Tidak ditemukan' }),
  },
});
