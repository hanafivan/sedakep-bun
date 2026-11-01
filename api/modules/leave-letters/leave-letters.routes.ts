import { createRoute, z } from '@hono/zod-openapi';
import {
  DELETE_LEAVE_LETTER_METHOD,
  GET_LEAVE_LETTER_METHOD,
  POST_LEAVE_LETTER_METHOD,
} from '../../shared/constant';
import { errors, okResponse } from '../../shared/openapi';
import {
  IdParamSchema,
  IssueLeaveLetterFormSchema,
  IssueLeaveLetterResponseSchema,
  IssueLetterSchema,
  LeaveLettersQuerySchema,
  LeaveLettersResponseSchema,
  LeaveRequestLettersResponseSchema,
  LetterFileResponseSchema,
  LetterParamSchema,
  RevokeLetterParamSchema,
  UploadLetterFileFormSchema,
} from './schema';

export const lettersList = createRoute({
  ...GET_LEAVE_LETTER_METHOD,
  path: '/leave/letters',
  summary: 'Daftar surat keterangan cuti',
  request: { query: LeaveLettersQuerySchema },
  responses: {
    ...okResponse(LeaveLettersResponseSchema, 'Daftar surat', 'LeaveLettersResponse'),
    ...errors([401]),
  },
});
export type LettersListRoute = typeof lettersList;

export const requestLetters = createRoute({
  ...GET_LEAVE_LETTER_METHOD,
  path: '/leave-requests/{id}/letters',
  summary: 'Daftar surat untuk satu permohonan',
  request: { params: IdParamSchema },
  responses: {
    ...okResponse(LeaveRequestLettersResponseSchema, 'Daftar surat', 'LeaveRequestLettersResponse'),
    ...errors([401]),
  },
});
export type RequestLettersRoute = typeof requestLetters;

export const issueLetter = createRoute({
  ...POST_LEAVE_LETTER_METHOD,
  path: '/leave-requests/{id}/letters',
  summary: 'Terbitkan surat keterangan (nomor otomatis bila kosong)',
  request: {
    params: IdParamSchema,
    body: {
      content: {
        'application/json': { schema: IssueLetterSchema },
        'multipart/form-data': { schema: IssueLeaveLetterFormSchema },
      },
    },
  },
  responses: {
    ...okResponse(IssueLeaveLetterResponseSchema, 'Surat diterbitkan', 'IssueLeaveLetterResponse'),
    ...errors({ 400: 'Belum final', 404: 'Tidak ditemukan', 422: 'Validasi gagal' }),
  },
});
export type IssueLetterRoute = typeof issueLetter;

export const letterFile = createRoute({
  ...POST_LEAVE_LETTER_METHOD,
  path: '/leave/letters/{id}/file',
  summary: 'Unggah/ganti berkas SK surat keterangan',
  request: {
    params: LetterParamSchema,
    body: {
      content: {
        'multipart/form-data': { schema: UploadLetterFileFormSchema },
      },
    },
  },
  responses: {
    ...okResponse(LetterFileResponseSchema, 'Berkas tersimpan', 'LetterFileResponse'),
    ...errors({ 404: 'Tidak ditemukan', 422: 'Berkas tidak valid' }),
  },
});
export type LetterFileRoute = typeof letterFile;

export const revokeLetter = createRoute({
  ...DELETE_LEAVE_LETTER_METHOD,
  path: '/leave-requests/{id}/letters/{letter_type}',
  summary: 'Cabut surat keterangan',
  request: { params: RevokeLetterParamSchema },
  responses: {
    ...okResponse(z.null(), 'Surat dicabut', 'RevokeLeaveLetterResponse'),
    ...errors([404]),
  },
});
export type RevokeLetterRoute = typeof revokeLetter;

