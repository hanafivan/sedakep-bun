import { withMysqlTransaction } from '../../../db/mysql';
import { badRequest } from '../../../shared/errors';
import {
  ANNUAL_LEAVE,
  computeQuota,
  resolveTmt,
  validateQuotaAvailability,
  type LeaveTransaction,
  type QuotaComputation,
  type ResolvedTmt,
} from './quota-engine';
import {
  findEligibilityOverride,
  findLeavePolicyByYear,
  findLeaveQuotasByUser,
  findLeaveTransactionsByUser,
  findPppkTmtByNip,
  findUserNipById,
  getAllActiveUserIds,
  sumQuotaAdjustmentsByBucket,
} from '../../leave-requests/query';
import {
  deleteQuotaAdjustment,
  deleteSetting,
  insertAuditLog,
  insertLeavePolicy,
  insertLeaveQuotaAudit,
  insertQuotaAdjustment,
  setEligibilityOverride as writeOverride,
  upsertLeaveQuota,
  upsertSetting,
} from '../../leave-requests/command';
import type { LeaveQuotaRow, LeaveTransactionRow } from '../../leave-requests/schema/types';

/**
 * Service kuota — orkestrasi + aturan. Tidak ada SQL di file ini.
 * Engine tetap pure; service hanya menyiapkan input dan menyimpan hasil.
 */

/**
 * Kolom DATE harus jadi 'YYYY-MM-DD'.
 *
 * Driver bisa mengembalikan string, Date, atau null — normalisasi di sini
 * supaya engine tidak pernah menerima tanggal yang tidak terbaca. Tanggal
 * yang tidak valid menghasilkan tahun NaN dan transaksi itu lolos dari
 * perhitungan kuota tanpa error; itu kegagalan senyap yang harus dicegah.
 */
export const toDateOnly = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value ?? '');
  const match = text.match(/^\d{4}-\d{2}-\d{2}/);
  if (match) return match[0];
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return '';
};

const toTransactions = (rows: LeaveTransactionRow[]): LeaveTransaction[] =>
  rows.map((row) => ({
    requestId: row.id,
    leaveType: row.leave_type,
    duration: Number(row.duration),
    durationUnit: (row.duration_unit ?? 'day') as LeaveTransaction['durationUnit'],
    startDate: toDateOnly(row.start_date),
    isFinal:
      row.admin_decision === 'accepted' &&
      row.approver_1_status === 'accepted' &&
      row.approver_2_status === 'accepted',
    isRejectedOrCancelled:
      row.admin_decision === 'rejected' ||
      row.admin_decision === 'cancelled' ||
      row.approver_1_status === 'rejected' ||
      row.approver_2_status === 'rejected',
  }));

export type QuotaContext = {
  userId: number;
  year: number;
  transactions: LeaveTransaction[];
  tmt: ResolvedTmt;
  /** Penyesuaian manual admin untuk tahun berjalan (bucket N). */
  adjustmentDays: number;
  /** Koreksi jatah bawaan tahun sebelumnya (bucket N-1 / N-2). */
  adjustmentBuckets: { n1: number; n2: number };
  /** Pernyataan layak manual admin, bila ada. */
  eligibilityOverride: { active: boolean; reason: string | null };
  policy: {
    defaultDays: number;
    carryOverMaxN1: number;
    carryOverMaxN2: number;
    minServiceMonths: number;
  };
};

/**
 * Siapkan konteks engine: identitas, TMT, policy, penyesuaian, dan transaksi.
 *
 * `executor` diisi saat dipanggil dari dalam transaksi ber-kunci: pembacaan
 * harus lewat koneksi yang sama supaya snapshot-nya diambil setelah kunci
 * didapat, bukan sebelum.
 */
export const buildQuotaContext = async (
  userId: number,
  year: number,
  executor?: import('mysql2/promise').PoolConnection,
): Promise<QuotaContext> => {
  const nip = await findUserNipById(userId, executor);
  const [pppkTmt, policy, transactions, adjustmentTotals, eligibilityOverride] = await Promise.all([
    nip ? findPppkTmtByNip(nip, executor) : Promise.resolve(null),
    findLeavePolicyByYear(year, executor),
    findLeaveTransactionsByUser(userId, executor),
    sumQuotaAdjustmentsByBucket(userId, year, executor),
    findEligibilityOverride(userId, year, executor),
  ]);

  return {
    userId,
    year,
    transactions: toTransactions(transactions),
    tmt: resolveTmt(nip ?? '', pppkTmt),
    adjustmentDays: adjustmentTotals.n,
    adjustmentBuckets: { n1: adjustmentTotals.n1, n2: adjustmentTotals.n2 },
    eligibilityOverride,
    policy: {
      defaultDays: policy?.default_days ?? 12,
      carryOverMaxN1: policy?.carry_over_max_n1 ?? 6,
      carryOverMaxN2: policy?.carry_over_max_n2 ?? 6,
      minServiceMonths: policy?.min_service_months ?? 12,
    },
  };
};

export const computeQuotaForUser = (
  context: QuotaContext,
  excludeRequestId?: number | null,
): QuotaComputation =>
  computeQuota({
    year: context.year,
    tmt: context.tmt,
    transactions: context.transactions,
    excludeRequestId: excludeRequestId ?? null,
    dailyQuota: context.policy.defaultDays,
    carryOverMaxN1: context.policy.carryOverMaxN1,
    carryOverMaxN2: context.policy.carryOverMaxN2,
    minimumServiceMonths: context.policy.minServiceMonths,
    adjustmentDays: context.adjustmentDays,
    adjustmentBuckets: context.adjustmentBuckets,
    eligibilityOverride: context.eligibilityOverride,
    referenceDate: `${context.year}-12-31`,
  });

export const getQuota = async (
  userId: number,
  year: number,
  excludeRequestId?: number | null,
  executor?: import('mysql2/promise').PoolConnection,
): Promise<QuotaComputation> => {
  const context = await buildQuotaContext(userId, year, executor);
  return computeQuotaForUser(context, excludeRequestId);
};

export const checkAvailability = async (
  userId: number,
  year: number,
  duration: number,
  leaveType: string,
  excludeRequestId?: number | null,
  executor?: import('mysql2/promise').PoolConnection,
) => {
  const quota = await getQuota(userId, year, excludeRequestId, executor);
  return validateQuotaAvailability(quota, duration, leaveType);
};

/** Rebuild projection `leave_quotas` dari histori request. Idempotent. */
export const rebuildQuota = async (
  userId: number,
  year: number,
  actorId?: number | null,
): Promise<QuotaComputation> => {
  const context = await buildQuotaContext(userId, year);
  const quota = computeQuotaForUser(context);

  // Kolom bruto di projection: jatah + hari yang sudah terpakai. Sebelumnya
  // `quota_n` menambahkan `adjustmentDays` di atas `official.n` yang sudah
  // memuatnya, sehingga koreksi admin terhitung dua kali di kolom bruto.
  const usedInYear = context.transactions
    .filter(
      (tx) =>
        tx.leaveType === ANNUAL_LEAVE &&
        tx.isFinal &&
        !tx.isRejectedOrCancelled &&
        toDateOnly(tx.startDate).slice(0, 4) === String(year),
    )
    .reduce((sum, tx) => sum + Number(tx.duration ?? 0), 0);

  await upsertLeaveQuota({
    user_id: userId,
    year,
    quota_n: quota.official.n + usedInYear,
    quota_n1: quota.official.n1,
    quota_n2: quota.official.n2,
    total_quota: quota.official.total + usedInYear,
    used_n: usedInYear,
    used_n1: 0,
    used_n2: 0,
    total_used: usedInYear,
    remaining_n: quota.available.n,
    remaining_n1: quota.available.n1,
    remaining_n2: quota.available.n2,
    total_remaining: quota.available.total,
    reserved_days: quota.reservedDays,
    reserved_count: quota.reservedCount,
    eligible: quota.eligibility.eligible,
    months_worked: quota.eligibility.monthsWorked,
    tmt_year: quota.eligibility.tmtYear,
    tmt_month: quota.eligibility.tmtMonth,
    manual_validation: quota.eligibility.manualValidation,
  });

  await insertLeaveQuotaAudit({
    user_id: userId,
    year,
    action: 'rebuild',
    after_data: {
      official: quota.official,
      available: quota.available,
      reserved_days: quota.reservedDays,
      adjustment_days: context.adjustmentDays,
      large_leave_applied: quota.largeLeaveApplied,
      manual_validation: quota.eligibility.manualValidation,
    },
    actor_id: actorId ?? null,
    reason: 'Rebuild projection dari histori leave_requests',
  });

  return quota;
};

/** Rebuild untuk semua user dalam satu tahun. Satu gagal tidak membatalkan semua. */
export const rebuildQuotaForAllUsers = async (
  year: number,
  actorId?: number | null,
): Promise<{ success: number; failed: number; errors: string[] }> => {
  const userIds = await getAllActiveUserIds();
  const stats = { success: 0, failed: 0, errors: [] as string[] };

  for (const userId of userIds) {
    try {
      await rebuildQuota(userId, year, actorId);
      stats.success += 1;
    } catch (error) {
      stats.failed += 1;
      stats.errors.push(`user ${userId}: ${(error as Error).message}`);
    }
  }
  return stats;
};

/**
 * Bawa-sisa (rollover) ke tahun berikutnya.
 *
 * Tidak menulis angka apa pun: engine sudah melakukan ini sendiri setiap kali
 * dihitung. Untuk tahun Y, pool Y-1 dan Y-2 yang belum terpakai otomatis
 * muncul sebagai N-1 dan N-2 (masing-masing maksimal `carry_over_max`).
 * Fungsi ini karena itu hanya menghitung ulang projection untuk seluruh
 * pegawai, ditambah jejak audit agar terlihat kapan rollover dijalankan.
 *
 * Legacy perlu fungsi rollover tersendiri karena `tbl_cuti_quota` di sana
 * adalah cache yang diisi manual; di sini projection selalu turunan histori.
 */
export const rolloverYear = async (
  year: number,
  actorId?: number | null,
): Promise<{ year: number; success: number; failed: number; errors: string[] }> => {
  const stats = await rebuildQuotaForAllUsers(year, actorId);

  // Satu catatan audit per tahun, bukan per pegawai, supaya riwayat tidak banjir.
  if (actorId) {
    await insertLeaveQuotaAudit({
      user_id: actorId,
      year,
      action: 'rollover',
      after_data: { success: stats.success, failed: stats.failed },
      actor_id: actorId,
      reason: `Rollover/projection tahun ${year} untuk seluruh pegawai`,
    });
  }
  return { year, ...stats };
};

/**
 * Terapkan kebijakan/SK kuota satu tahun.
 *
 * Cukup menulis baris `leave_policies`: engine membaca `default_days` tahun itu
 * saat menghitung, jadi jatah tahun tersebut (dan bawaan-sisanya) langsung ikut
 * berubah. `confirm` wajib bernilai true kalau tahun itu sudah pernah diterapkan,
 * supaya penerapan ganda tidak terjadi tanpa disengaja.
 */
export const applyLeavePolicy = async (
  input: {
    year: number;
    default_days: number;
    days_after_sk?: number;
    sk_applied?: boolean;
    sk_issued_at?: string | null;
    notes?: string | null;
    carry_over_max_n1?: number;
    carry_over_max_n2?: number;
    min_service_months?: number;
    confirm?: boolean;
  },
  actorId?: number | null,
): Promise<{ year: number; applied: boolean; default_days: number }> => {
  const existing = await findLeavePolicyByYear(input.year);
  if (existing && existing.sk_applied === 1 && !input.confirm) {
    throw badRequest(
      `Kebijakan tahun ${input.year} sudah pernah diterapkan (${existing.default_days} hari). Kirim confirm=true untuk menimpanya.`,
    );
  }

  await insertLeavePolicy({
    year: input.year,
    default_days: input.default_days,
    days_after_sk: input.days_after_sk ?? input.default_days,
    sk_applied: input.sk_applied === false ? 0 : 1,
    sk_issued_at: input.sk_issued_at ?? null,
    notes: input.notes ?? null,
    carry_over_max_n1: input.carry_over_max_n1,
    carry_over_max_n2: input.carry_over_max_n2,
    min_service_months: input.min_service_months,
  });

  await insertAuditLog({
    actor_id: actorId ?? null,
    action: 'leave_policy_apply',
    entity_table: 'leave_policies',
    entity_id: input.year,
    before_data: existing ?? null,
    after_data: { ...input },
  });

  return { year: input.year, applied: true, default_days: input.default_days };
};

/** Penyesuaian manual kuota oleh admin (mis. koreksi saldo). */
export const adjustUserQuota = async (
  input: {
    user_id: number;
    year: number;
    days: number;
    /** Bucket yang dikoreksi; legacy menyunting N, N-1, dan N-2 sekaligus. */
    bucket?: 'n' | 'n1' | 'n2';
    reason?: string | null;
  },
  actorId?: number | null,
) => {
  if (input.days === 0) throw badRequest('Penyesuaian tidak boleh 0 hari');

  const id = await insertQuotaAdjustment({
    user_id: input.user_id,
    year: input.year,
    days: input.days,
    bucket: input.bucket ?? 'n',
    reason: input.reason ?? null,
    actor_id: actorId ?? null,
  });

  await insertAuditLog({
    actor_id: actorId ?? null,
    action: 'quota_adjustment',
    entity_table: 'leave_quota_adjustments',
    entity_id: id,
    after_data: { ...input },
  });

  const quota = await rebuildQuota(input.user_id, input.year, actorId ?? null);
  return { id, user_id: input.user_id, year: input.year, days: input.days, quota };
};

export const removeQuotaAdjustment = async (
  id: number,
  userId: number,
  year: number,
  actorId?: number | null,
) => {
  await deleteQuotaAdjustment(id);
  await insertAuditLog({
    actor_id: actorId ?? null,
    action: 'quota_adjustment_remove',
    entity_table: 'leave_quota_adjustments',
    entity_id: id,
    after_data: { user_id: userId, year },
  });
  await rebuildQuota(userId, year, actorId ?? null);
};

/** Admin menyatakan pegawai layak (atau membatalkannya) untuk satu tahun. */
export const setEligibilityOverride = async (
  input: { user_id: number; year: number; active: boolean; reason?: string | null },
  actorId?: number | null,
) => {
  if (input.active && !input.reason?.trim()) {
    throw badRequest('Alasan validasi manual wajib diisi');
  }

  await writeOverride(input.user_id, input.year, {
    active: input.active,
    reason: input.reason ?? null,
  });

  await insertLeaveQuotaAudit({
    user_id: input.user_id,
    year: input.year,
    action: 'admin_override',
    after_data: { active: input.active, reason: input.reason ?? null },
    actor_id: actorId ?? null,
    reason: input.active
      ? `Validasi manual: ${input.reason}`
      : 'Validasi manual dibatalkan',
  });

  const quota = await rebuildQuota(input.user_id, input.year, actorId ?? null);
  return { user_id: input.user_id, year: input.year, active: input.active, quota };
};

/** TMT PPPK: dibaca dari `settings` pengganti tabel tbl_pppk_tmt legacy. */
export const setPppkTmt = async (
  input: { nip: string; tmt_date: string | null },
  actorId?: number | null,
) => {
  if (input.tmt_date) {
    await upsertSetting(`pppk_tmt:${input.nip}`, input.tmt_date, 'TMT PPPK hasil validasi');
  } else {
    await deleteSetting(`pppk_tmt:${input.nip}`);
  }
  await insertAuditLog({
    actor_id: actorId ?? null,
    action: 'pppk_tmt_set',
    entity_table: 'settings',
    entity_id: null,
    after_data: { nip: input.nip, tmt_date: input.tmt_date },
  });
  return { nip: input.nip, tmt_date: input.tmt_date };
};

export { ANNUAL_LEAVE };
void findLeaveQuotasByUser;
void withMysqlTransaction;
export type { LeaveQuotaRow };
