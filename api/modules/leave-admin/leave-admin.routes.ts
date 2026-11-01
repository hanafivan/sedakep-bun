import { createRoute, z } from '@hono/zod-openapi';
import {
  DELETE_LEAVE_ADMIN_METHOD,
  GET_LEAVE_ADMIN_METHOD,
  POST_LEAVE_ADMIN_METHOD,
  PUT_LEAVE_ADMIN_METHOD,
} from '../../shared/constant';
import { errors, json, okResponse } from '../../shared/openapi';
import {
  ClosurePeriodCreateResponseSchema,
  ClosurePeriodSchema,
  ClosurePeriodUpdateResponseSchema,
  ClosurePeriodsResponseSchema,
  ExportCsvResponseSchema,
  IdParamSchema,
  InstanceProfileResponseSchema,
  InstanceProfileWriteResponseSchema,
  InstanceProfileWriteSchema,
  LeaveExportWithFormatQuerySchema,
  LeaveUserDirectoryQuerySchema,
  LeaveUserDirectoryResponseSchema,
  LeaveYearlySummaryResponseSchema,
  PppkTmtResponseSchema,
  PppkTmtWriteResponseSchema,
  PppkTmtWriteSchema,
  QuotaAuditTrailQuerySchema,
  QuotaAuditTrailResponseSchema,
  QuotaBookQuerySchema,
  QuotaBookResponseSchema,
  YearQuerySchema,
} from './schema';

export const instanceProfile = createRoute({
  ...GET_LEAVE_ADMIN_METHOD,
  path: '/leave/admin/instance',
  summary: 'Identitas instansi (kop surat)',
  responses: {
    ...okResponse(InstanceProfileResponseSchema, 'Identitas instansi', 'InstanceProfileResponse'),
    ...errors([401]),
  },
});
export type InstanceProfileRoute = typeof instanceProfile;

export const instanceProfileWrite = createRoute({
  ...PUT_LEAVE_ADMIN_METHOD,
  path: '/leave/admin/instance',
  summary: 'Ubah identitas instansi',
  request: { body: json(InstanceProfileWriteSchema) },
  responses: {
    ...okResponse(InstanceProfileWriteResponseSchema, 'Identitas tersimpan', 'InstanceProfileWriteResponse'),
    ...errors([401, 403]),
  },
});
export type InstanceProfileWriteRoute = typeof instanceProfileWrite;

export const closurePeriodsList = createRoute({
  ...GET_LEAVE_ADMIN_METHOD,
  path: '/leave/admin/closure-periods',
  summary: 'Daftar periode tutup cuti tahunan',
  request: { query: YearQuerySchema },
  responses: {
    ...okResponse(ClosurePeriodsResponseSchema, 'Daftar periode', 'ClosurePeriodsResponse'),
    ...errors([401]),
  },
});
export type ClosurePeriodsListRoute = typeof closurePeriodsList;

export const createClosurePeriod = createRoute({
  ...POST_LEAVE_ADMIN_METHOD,
  path: '/leave/admin/closure-periods',
  summary: 'Buat periode tutup cuti tahunan baru',
  request: { body: json(ClosurePeriodSchema) },
  responses: {
    ...okResponse(ClosurePeriodCreateResponseSchema, 'Periode dibuat', 'ClosurePeriodCreateResponse'),
    ...errors([401, 403, 422]),
  },
});
export type CreateClosurePeriodRoute = typeof createClosurePeriod;

export const updateClosurePeriod = createRoute({
  ...PUT_LEAVE_ADMIN_METHOD,
  path: '/leave/admin/closure-periods/{id}',
  summary: 'Ubah periode tutup cuti tahunan',
  request: { params: IdParamSchema, body: json(ClosurePeriodSchema) },
  responses: {
    ...okResponse(ClosurePeriodUpdateResponseSchema, 'Periode diubah', 'ClosurePeriodUpdateResponse'),
    ...errors([401, 403, 404, 422]),
  },
});
export type UpdateClosurePeriodRoute = typeof updateClosurePeriod;

export const deleteClosurePeriod = createRoute({
  ...DELETE_LEAVE_ADMIN_METHOD,
  path: '/leave/admin/closure-periods/{id}',
  summary: 'Hapus periode tutup cuti tahunan',
  request: { params: IdParamSchema },
  responses: {
    ...okResponse(z.null(), 'Periode dihapus', 'ClosurePeriodDeleteResponse'),
    ...errors([401, 403, 404]),
  },
});
export type DeleteClosurePeriodRoute = typeof deleteClosurePeriod;

export const quotaBook = createRoute({
  ...GET_LEAVE_ADMIN_METHOD,
  path: '/leave/admin/quota-book',
  summary: 'Buku cuti seluruh pegawai (proyeksi + akumulasi pemakaian)',
  request: { query: QuotaBookQuerySchema },
  responses: {
    ...okResponse(QuotaBookResponseSchema, 'Buku cuti pegawai', 'QuotaBookResponse'),
    ...errors([401, 403]),
  },
});
export type QuotaBookRoute = typeof quotaBook;

export const userDirectory = createRoute({
  ...GET_LEAVE_ADMIN_METHOD,
  path: '/leave/admin/users',
  summary: 'Daftar pegawai (untuk kelola kuota)',
  request: { query: LeaveUserDirectoryQuerySchema },
  responses: {
    ...okResponse(LeaveUserDirectoryResponseSchema, 'Daftar pegawai', 'LeaveUserDirectoryResponse'),
    ...errors([401, 403]),
  },
});
export type UserDirectoryRoute = typeof userDirectory;

export const quotaAuditTrail = createRoute({
  ...GET_LEAVE_ADMIN_METHOD,
  path: '/leave/admin/quota-audit',
  summary: 'Riwayat mutasi kuota seluruh pegawai (audit trail)',
  request: { query: QuotaAuditTrailQuerySchema },
  responses: {
    ...okResponse(QuotaAuditTrailResponseSchema, 'Audit trail kuota', 'QuotaAuditTrailResponse'),
    ...errors([401, 403]),
  },
});
export type QuotaAuditTrailRoute = typeof quotaAuditTrail;

export const pppkTmt = createRoute({
  ...GET_LEAVE_ADMIN_METHOD,
  path: '/leave/admin/pppk-tmt',
  summary: 'Daftar TMT PPPK hasil verifikasi manual (dan yang masih kosong)',
  responses: {
    ...okResponse(PppkTmtResponseSchema, 'Daftar TMT PPPK', 'PppkTmtResponse'),
    ...errors([401, 403]),
  },
});
export type PppkTmtRoute = typeof pppkTmt;

export const pppkTmtWrite = createRoute({
  ...PUT_LEAVE_ADMIN_METHOD,
  path: '/leave/admin/pppk-tmt',
  summary: 'Set / ubah TMT pegawai PPPK tertentu',
  request: { body: json(PppkTmtWriteSchema) },
  responses: {
    ...okResponse(PppkTmtWriteResponseSchema, 'TMT PPPK tersimpan', 'PppkTmtWriteResponse'),
    ...errors([401, 403, 422]),
  },
});
export type PppkTmtWriteRoute = typeof pppkTmtWrite;

/** Rekap tahunan untuk dasbor admin (legacy `admin.php:240-265`). */
export const leaveYearlySummary = createRoute({
  ...GET_LEAVE_ADMIN_METHOD,
  path: '/leave/admin/yearly-summary',
  summary: 'Rekap jumlah permohonan per tahun (pengajuan/diterima/ditolak/dibatalkan)',
  responses: {
    ...okResponse(LeaveYearlySummaryResponseSchema, 'Rekap tahunan', 'LeaveYearlySummaryResponse'),
    ...errors([401, 403]),
  },
});
export type LeaveYearlySummaryRoute = typeof leaveYearlySummary;

/**
 * Ekspor CSV. Legacy membatasinya ke super admin (`admin.php?page=tsm` menolak
 * akun non-super-admin), dan penjaga `/leave/admin/*` di atas menegakkan hal
 * yang sama.
 */
export const leaveExport = createRoute({
  ...GET_LEAVE_ADMIN_METHOD,
  path: '/leave/admin/export',
  summary: 'Ekspor permohonan cuti (CSV) dengan filter tanggal/status/jenis/SK',
  request: {
    query: LeaveExportWithFormatQuerySchema,
  },
  responses: {
    200: {
      description: 'Berkas CSV',
      content: {
        'text/csv': { schema: ExportCsvResponseSchema },
      },
    },
    ...errors([401, 403, 422]),
  },
});
export type LeaveExportRoute = typeof leaveExport;

