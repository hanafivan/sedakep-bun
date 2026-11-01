import { createRoute, z } from '@hono/zod-openapi';
import {
  DELETE_LEAVE_QUOTA_METHOD,
  GET_LEAVE_QUOTA_METHOD,
  POST_LEAVE_QUOTA_METHOD,
  PUT_LEAVE_QUOTA_METHOD,
} from '../../shared/constant';
import { errors, json, okResponse } from '../../shared/openapi';
import {
  EligibilityOverrideResponseSchema,
  EligibilityOverrideSchema,
  IdParamSchema,
  LeavePolicyResponseSchema,
  LeavePolicyWriteResponseSchema,
  LeaveQuotaAvailableQuerySchema,
  MeOrIdParamSchema,
  PolicyWriteSchema,
  QuotaAdjustmentDeleteQuerySchema,
  QuotaAdjustmentListResponseSchema,
  QuotaAdjustmentResponseSchema,
  QuotaAdjustmentSchema,
  QuotaBookPrintResponseSchema,
  QuotaHistoryResponseSchema,
  QuotaQuerySchema,
  QuotaRebuildResponseSchema,
  QuotaResponseSchema,
  QuotaRolloverBodySchema,
  QuotaRolloverResponseSchema,
  RebuildSchema,
  StoredQuotaResponseSchema,
  YearQuerySchema,
} from './schema';

export const quotaAvailable = createRoute({
  ...GET_LEAVE_QUOTA_METHOD,
  path: '/leave/quota/available',
  summary: 'Saldo tersedia (available) untuk user dan tahun tertentu',
  request: {
    query: LeaveQuotaAvailableQuerySchema,
  },
  responses: {
    ...okResponse(QuotaResponseSchema, 'Saldo tersedia', 'QuotaAvailableResponse'),
    ...errors([401, 422]),
  },
});
export type QuotaAvailableRoute = typeof quotaAvailable;

export const quota = createRoute({
  ...GET_LEAVE_QUOTA_METHOD,
  path: '/leave/quota/{user_id}',
  summary: 'Saldo kuota (official, reserved, available)',
  request: { query: QuotaQuerySchema, params: MeOrIdParamSchema },
  responses: {
    ...okResponse(QuotaResponseSchema, 'Saldo kuota', 'QuotaSummaryResponse'),
    ...errors([422]),
  },
});
export type QuotaRoute = typeof quota;

export const policy = createRoute({
  ...GET_LEAVE_QUOTA_METHOD,
  path: '/leave/policy',
  summary: 'Kebijakan kuota satu tahun',
  request: { query: YearQuerySchema },
  responses: {
    ...okResponse(LeavePolicyResponseSchema, 'Kebijakan kuota', 'LeavePolicyResponse'),
    ...errors([401, 404]),
  },
});
export type PolicyRoute = typeof policy;

export const policyWrite = createRoute({
  ...PUT_LEAVE_QUOTA_METHOD,
  path: '/leave/policy',
  summary: 'Terapkan kebijakan/SK kuota satu tahun (admin)',
  request: { body: json(PolicyWriteSchema) },
  responses: {
    ...okResponse(LeavePolicyWriteResponseSchema, 'Kebijakan diterapkan', 'LeavePolicyWriteResponse'),
    ...errors([401, 403], { 400: 'Sudah diterapkan' }),
  },
});
export type PolicyWriteRoute = typeof policyWrite;

export const quotaHistory = createRoute({
  ...GET_LEAVE_QUOTA_METHOD,
  path: '/leave/quota/history/{user_id}',
  summary: 'Riwayat audit kuota',
  request: { query: QuotaQuerySchema, params: MeOrIdParamSchema },
  responses: {
    ...okResponse(QuotaHistoryResponseSchema, 'Riwayat kuota', 'QuotaHistoryResponse'),
    ...errors([422]),
  },
});
export type QuotaHistoryRoute = typeof quotaHistory;

export const quotaBookPrint = createRoute({
  ...GET_LEAVE_QUOTA_METHOD,
  path: '/leave/quota/book/{user_id}',
  summary: 'Data cetak buku cuti satu pegawai (projection + identitas + kop)',
  request: { params: MeOrIdParamSchema },
  responses: {
    ...okResponse(QuotaBookPrintResponseSchema, 'Data buku cuti', 'QuotaBookPrintResponse'),
    ...errors([401, 404], { 403: 'Bukan pemilik' }),
  },
});
export type QuotaBookPrintRoute = typeof quotaBookPrint;

export const quotaStored = createRoute({
  ...GET_LEAVE_QUOTA_METHOD,
  path: '/leave/quota/stored/{user_id}',
  summary: 'Saldo kuota tersimpan (projection)',
  request: { params: MeOrIdParamSchema },
  responses: {
    ...okResponse(StoredQuotaResponseSchema, 'Saldo tersimpan per tahun', 'StoredQuotaResponse'),
    ...errors([401]),
  },
});
export type QuotaStoredRoute = typeof quotaStored;

export const quotaRebuild = createRoute({
  ...POST_LEAVE_QUOTA_METHOD,
  path: '/leave/quota/rebuild/{user_id}',
  summary: 'Rebuild projection kuota dari histori permohonan',
  request: { body: json(RebuildSchema), params: MeOrIdParamSchema },
  responses: {
    ...okResponse(QuotaRebuildResponseSchema, 'Hasil rebuild', 'QuotaRebuildResponse'),
    ...errors([422]),
  },
});
export type QuotaRebuildRoute = typeof quotaRebuild;

export const rollover = createRoute({
  ...POST_LEAVE_QUOTA_METHOD,
  path: '/leave/quota/rollover',
  summary: 'Hitung ulang projection seluruh pegawai untuk satu tahun (bawa sisa)',
  request: { body: json(QuotaRolloverBodySchema) },
  responses: {
    ...okResponse(QuotaRolloverResponseSchema, 'Hasil rollover', 'QuotaRolloverResponse'),
    ...errors([401, 403]),
  },
});
export type RolloverRoute = typeof rollover;

export const quotaAdjustment = createRoute({
  ...POST_LEAVE_QUOTA_METHOD,
  path: '/leave/quota/adjustment',
  summary: 'Penyesuaian kuota manual oleh admin',
  request: { body: json(QuotaAdjustmentSchema) },
  responses: {
    ...okResponse(QuotaAdjustmentResponseSchema, 'Kuota disesuaikan', 'QuotaAdjustmentResponse'),
    ...errors([401, 403, 422]),
  },
});
export type QuotaAdjustmentRoute = typeof quotaAdjustment;

export const quotaAdjustmentList = createRoute({
  ...GET_LEAVE_QUOTA_METHOD,
  path: '/leave/quota/adjustment/{user_id}',
  summary: 'Daftar penyesuaian kuota manual satu pegawai',
  request: { params: MeOrIdParamSchema, query: YearQuerySchema },
  responses: {
    ...okResponse(QuotaAdjustmentListResponseSchema, 'Daftar penyesuaian', 'QuotaAdjustmentListResponse'),
    ...errors([401]),
  },
});
export type QuotaAdjustmentListRoute = typeof quotaAdjustmentList;

export const quotaAdjustmentDelete = createRoute({
  ...DELETE_LEAVE_QUOTA_METHOD,
  path: '/leave/quota/adjustment/{id}',
  summary: 'Batalkan penyesuaian kuota manual',
  request: { params: IdParamSchema, query: QuotaAdjustmentDeleteQuerySchema },
  responses: {
    ...okResponse(z.null(), 'Penyesuaian dibatalkan', 'QuotaAdjustmentDeleteResponse'),
    ...errors([404]),
  },
});
export type QuotaAdjustmentDeleteRoute = typeof quotaAdjustmentDelete;

export const eligibilityOverride = createRoute({
  ...POST_LEAVE_QUOTA_METHOD,
  path: '/leave/quota/eligibility-override',
  summary: 'Admin menyatakan pegawai layak cuti (atau membatalkannya)',
  request: { body: json(EligibilityOverrideSchema) },
  responses: {
    ...okResponse(EligibilityOverrideResponseSchema, 'Validasi manual tersimpan', 'EligibilityOverrideResponse'),
    ...errors([401, 403], { 422: 'Alasan wajib diisi' }),
  },
});
export type EligibilityOverrideRoute = typeof eligibilityOverride;

