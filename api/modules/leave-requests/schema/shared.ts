import { z } from 'zod';
export { ApiErrorSchema, errorResponses, json, ok } from '../../../shared/openapi';

/** Potongan schema yang dipakai lebih dari satu modul. */

/** Baris ringkas untuk tabel di UI. */
export const LeaveRequestSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  name: z.string(),
  nip: z.string().nullable(),
  leave_type: z.string(),
  duration: z.number(),
  duration_unit: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  reason: z.string().nullable(),
  status: z.string(),
  admin_decision: z.string(),
  approver_1_status: z.string(),
  approver_1_name: z.string().nullable().optional(),
  approver_1_nip: z.string().nullable().optional(),
  approver_1_position: z.string().nullable().optional(),
  approver_2_status: z.string(),
  approver_2_name: z.string().nullable().optional(),
  approver_2_nip: z.string().nullable().optional(),
  approver_2_position: z.string().nullable().optional(),
  rejection_reason: z.string().nullable(),
}).openapi('LeaveRequest');

export const QuotaBucketSchema = z.object({
  n: z.number(),
  n1: z.number(),
  n2: z.number(),
  total: z.number(),
}).openapi('QuotaBucket');

/** Satu respons; dipakai UI untuk kartu saldo dan simulasi. */
export const QuotaResponseSchema = z.object({
  year: z.number(),
  official: QuotaBucketSchema,
  reserved_days: z.number(),
  reserved_count: z.number(),
  available: QuotaBucketSchema,
  eligibility: z.object({
    eligible: z.boolean(),
    reason: z.string(),
    months_worked: z.number(),
    is_pppk: z.boolean(),
    manual_validation: z.boolean(),
  }),
}).openapi('QuotaResponse');

/** Baris projection tersimpan (bukan hasil hitung langsung). */
export const StoredQuotaSchema = z.object({
  year: z.number(),
  remaining_n: z.number(),
  remaining_n1: z.number(),
  remaining_n2: z.number(),
  total_remaining: z.number(),
  reserved_days: z.number(),
  reserved_count: z.number(),
  eligible: z.number(),
  manual_validation: z.number(),
  computed_at: z.string().nullable(),
}).openapi('StoredQuota');
