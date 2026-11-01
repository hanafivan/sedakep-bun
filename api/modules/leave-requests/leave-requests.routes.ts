import { createRoute, z } from '@hono/zod-openapi';
import {
  DELETE_LEAVE_METHOD,
  GET_LEAVE_METHOD,
  PATCH_LEAVE_METHOD,
  POST_LEAVE_APPROVAL_METHOD,
  POST_LEAVE_LETTER_METHOD,
  POST_LEAVE_METHOD,
} from '../../shared/constant';
import { errors, json, okResponse } from '../../shared/openapi';
import {
  AdminDecisionResponseSchema,
  ApprovalSummaryQuerySchema,
  ApprovalSummaryResponseSchema,
  ApproveLevelParamSchema,
  CancelLeaveResponseSchema,
  CancelSchema,
  CreateLeaveRequestFormSchema,
  CreateLeaveRequestSchema,
  CreateLeaveResponseSchema,
  DecisionSchema,
  IdParamSchema,
  LeaveApproverListResponseSchema,
  LeaveApproverQuerySchema,
  LeaveFormPdfResponseSchema,
  LeaveLegacyHistoryQuerySchema,
  LeaveLegacyHistoryResponseSchema,
  LeavePdfResponseSchema,
  LeaveRequestDetailResponseSchema,
  LeaveRequestListResponseSchema,
  LeaveStatisticsQuerySchema,
  LeaveStatisticsResponseSchema,
  LeaveTypeOptionsResponseSchema,
  LevelDecisionResponseSchema,
  ListQuerySchema,
  MeOrIdParamSchema,
  UpdateLeaveRequestSchema,
  UpdateLeaveResponseSchema,
} from './schema';

// ---------------------------------------------------------------------------
// Permohonan cuti
// ---------------------------------------------------------------------------

export const listLeaveRequests = createRoute({
  ...GET_LEAVE_METHOD,
  path: '/leave-requests',
  summary: 'Daftar permohonan cuti',
  request: { query: ListQuerySchema },
  responses: {
    ...okResponse(LeaveRequestListResponseSchema, 'Daftar permohonan', 'LeaveRequestListResponse'),
    ...errors([401, 422]),
  },
});
export type ListLeaveRequestsRoute = typeof listLeaveRequests;

export const approvalSummary = createRoute({
  ...GET_LEAVE_METHOD,
  path: '/leave/approvals/summary',
  summary: 'Ringkasan antrean persetujuan cuti berjenjang',
  request: {
    query: ApprovalSummaryQuerySchema,
  },
  responses: {
    ...okResponse(ApprovalSummaryResponseSchema, 'Ringkasan antrean', 'ApprovalSummaryResponse'),
    ...errors([401]),
  },
});
export type ApprovalSummaryRoute = typeof approvalSummary;

/** Arsip per status + rekap jenis cuti (dasar halaman cuti jadi/ditolak/…). */
export const leaveStatistics = createRoute({
  ...GET_LEAVE_METHOD,
  path: '/leave-requests/statistics',
  summary: 'Rekap jumlah permohonan per status dan jenis cuti',
  request: {
    query: LeaveStatisticsQuerySchema,
  },
  responses: {
    ...okResponse(LeaveStatisticsResponseSchema, 'Rekap permohonan', 'LeaveStatisticsResponse'),
    ...errors([401]),
  },
});
export type LeaveStatisticsRoute = typeof leaveStatistics;

export const leaveTypeOptions = createRoute({
  ...GET_LEAVE_METHOD,
  path: '/leave/types/{user_id}',
  summary: 'Jenis cuti yang boleh diajukan pegawai beserta aturannya',
  request: { params: MeOrIdParamSchema },
  responses: {
    ...okResponse(LeaveTypeOptionsResponseSchema, 'Opsi jenis cuti', 'LeaveTypeOptionsResponse'),
    ...errors([401]),
  },
});
export type LeaveTypeOptionsRoute = typeof leaveTypeOptions;

export const approverSuggestions = createRoute({
  ...GET_LEAVE_METHOD,
  path: '/leave/approvers',
  summary: 'Daftar saran atasan/pejabat untuk form pengajuan cuti',
  request: {
    query: LeaveApproverQuerySchema,
  },
  responses: {
    ...okResponse(
      LeaveApproverListResponseSchema,
      'Daftar atasan/pejabat',
      'ApproverSuggestionsResponse',
    ),
    ...errors([401]),
  },
});
export type ApproverSuggestionsRoute = typeof approverSuggestions;

export const getLeaveRequest = createRoute({
  ...GET_LEAVE_METHOD,
  path: '/leave-requests/{id}',
  summary: 'Detail satu permohonan cuti (termasuk verifikasi dan surat)',
  request: { params: IdParamSchema },
  responses: {
    ...okResponse(LeaveRequestDetailResponseSchema, 'Detail permohonan cuti', 'LeaveRequestDetailResponse'),
    ...errors([401, 404]),
  },
});
export type GetLeaveRequestRoute = typeof getLeaveRequest;

export const generateLeavePdf = createRoute({
  ...POST_LEAVE_LETTER_METHOD,
  path: '/leave-requests/{id}/pdf',
  summary: 'Hasilkan PDF surat keterangan cuti (SK) + QR',
  request: { params: IdParamSchema },
  responses: {
    ...okResponse(LeavePdfResponseSchema, 'PDF siap diunduh', 'GenerateLeavePdfResponse'),
    ...errors([401, 404]),
  },
});
export type GenerateLeavePdfRoute = typeof generateLeavePdf;

export const generateLeaveFormPdf = createRoute({
  ...POST_LEAVE_LETTER_METHOD,
  path: '/leave-requests/{id}/form-pdf',
  summary: 'Hasilkan Formulir Permohonan Cuti (format BKN)',
  request: { params: IdParamSchema },
  responses: {
    ...okResponse(LeaveFormPdfResponseSchema, 'Formulir PDF siap diunduh', 'GenerateLeaveFormPdfResponse'),
    ...errors([401, 404]),
  },
});
export type GenerateLeaveFormPdfRoute = typeof generateLeaveFormPdf;

export const createLeaveRequest = createRoute({
  ...POST_LEAVE_METHOD,
  path: '/leave-requests',
  summary: 'Ajukan permohonan cuti (validasi kuota server-side + kunci user/tahun)',
  request: {
    body: {
      content: {
        'application/json': { schema: CreateLeaveRequestSchema },
        // Lampiran boleh disertakan langsung saat mengajukan.
        'multipart/form-data': {
          schema: CreateLeaveRequestFormSchema,
        },
      },
    },
  },
  responses: {
    ...okResponse(
      CreateLeaveResponseSchema,
      'Permohonan dibuat',
      'CreateLeaveResponse',
    ),
    ...errors([409, 422], { 400: 'Kuota tidak cukup / tidak eligible' }),
  },
});
export type CreateLeaveRequestRoute = typeof createLeaveRequest;

export const updateLeaveRequest = createRoute({
  ...PATCH_LEAVE_METHOD,
  path: '/leave-requests/{id}',
  summary: 'Ubah permohonan cuti (mengecualikan dirinya dari perhitungan kuota)',
  request: { params: IdParamSchema, body: json(UpdateLeaveRequestSchema) },
  responses: {
    ...okResponse(
      UpdateLeaveResponseSchema,
      'Permohonan diubah',
      'UpdateLeaveResponse',
    ),
    ...errors([404, 409, 422], { 400: 'Sudah final / kuota tidak cukup' }),
  },
});
export type UpdateLeaveRequestRoute = typeof updateLeaveRequest;

export const deleteLeaveRequest = createRoute({
  ...DELETE_LEAVE_METHOD,
  path: '/leave-requests/{id}',
  summary: 'Hapus permohonan cuti yang belum final',
  request: { params: IdParamSchema },
  responses: {
    ...okResponse(z.null(), 'Permohonan dihapus', 'DeleteLeaveResponse'),
    ...errors([404], { 400: 'Sudah final' }),
  },
});
export type DeleteLeaveRequestRoute = typeof deleteLeaveRequest;

export const approveAdmin = createRoute({
  ...POST_LEAVE_APPROVAL_METHOD,
  path: '/leave-requests/{id}/approve/admin',
  summary: 'Keputusan admin (approval utama)',
  request: { params: IdParamSchema, body: json(DecisionSchema) },
  responses: {
    ...okResponse(AdminDecisionResponseSchema, 'Keputusan tersimpan', 'AdminDecisionResponse'),
    ...errors([404, 422]),
  },
});
export type ApproveAdminRoute = typeof approveAdmin;

export const approveLevel = createRoute({
  ...POST_LEAVE_APPROVAL_METHOD,
  // Segmen parsial seperti `level-{level}` terdaftar di OpenAPI tetapi tidak
  // dikompilasi router Hono (selalu 404). Pakai segmen path biasa.
  path: '/leave-requests/{id}/approve/level/{level}',
  summary: 'Keputusan atasan level 1 atau 2',
  request: {
    params: ApproveLevelParamSchema,
    body: json(DecisionSchema),
  },
  responses: {
    ...okResponse(
      LevelDecisionResponseSchema,
      'Keputusan tersimpan',
      'ApproverDecisionResponse',
    ),
    ...errors([404], { 400: 'Urutan approval salah' }),
  },
});
export type ApproveLevelRoute = typeof approveLevel;

export const cancelLeave = createRoute({
  ...POST_LEAVE_APPROVAL_METHOD,
  path: '/leave-requests/{id}/cancel',
  summary: 'Batalkan permohonan cuti',
  request: { params: IdParamSchema, body: json(CancelSchema) },
  responses: {
    ...okResponse(CancelLeaveResponseSchema, 'Permohonan dibatalkan', 'CancelLeaveResponse'),
    ...errors([404]),
  },
});
export type CancelLeaveRoute = typeof cancelLeave;

// ---------------------------------------------------------------------------
// Riwayat cuti lama
// ---------------------------------------------------------------------------

/** Riwayat cuti pra-2020; pegawai hanya melihat miliknya sendiri. */
export const leaveLegacyHistory = createRoute({
  ...GET_LEAVE_METHOD,
  path: '/leave/legacy-history',
  summary: 'Riwayat cuti pra-2020 (hasil migrasi tbl_n2019)',
  request: { query: LeaveLegacyHistoryQuerySchema },
  responses: {
    ...okResponse(LeaveLegacyHistoryResponseSchema, 'Riwayat cuti lama', 'LeaveLegacyHistoryResponse'),
    ...errors([401]),
  },
});
export type LeaveLegacyHistoryRoute = typeof leaveLegacyHistory;
