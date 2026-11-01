import type { Pool, PoolConnection } from 'mysql2/promise';
import { getMySql } from '../../../db/mysql';
import type { LeaveRequestRow } from '../schema/types';

/**
 * COMMAND = operasi tulis modul cuti. Semua INSERT/UPDATE/DELETE ada di sini.
 * Tidak ada logika bisnis di file ini.
 *
 * Setiap fungsi menerima `executor` opsional: saat dipanggil di dalam
 * transaksi, pemanggil wajib menyerahkan koneksi transaksinya supaya tulisan
 * ikut ter-commit/rollback bersama yang lain.
 */

export type Executor = Pool | PoolConnection;

export type NewLeaveRequest = {
  user_id: number;
  legacy_user_id?: number | null;
  name: string;
  nip?: string | null;
  grade?: string | null;
  position?: string | null;
  organization_name?: string | null;
  service_years?: string | null;
  leave_type: string;
  duration: number;
  duration_unit?: 'day' | 'month' | 'year';
  start_date: string;
  end_date: string;
  reason?: string | null;
  address?: string | null;
  phone?: string | null;
  approver_1_name?: string | null;
  approver_1_nip?: string | null;
  approver_1_position?: string | null;
  approver_2_name?: string | null;
  approver_2_nip?: string | null;
  approver_2_position?: string | null;
  legacy_id?: string | null;
  anomaly_flag?: string | null;
};

export const insertLeaveRequest = async (
  data: NewLeaveRequest,
  executor: Executor = getMySql(),
): Promise<number> => {
  const sql = `
    INSERT INTO leave_requests (
      user_id, legacy_user_id, name, nip, grade, position, organization_name, service_years,
      leave_type, duration, duration_unit, start_date, end_date, reason, address, phone,
      approver_1_name, approver_1_nip, approver_1_position,
      approver_2_name, approver_2_nip, approver_2_position,
      legacy_id, anomaly_flag
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `;
  const [result] = await executor.execute<import('mysql2/promise').ResultSetHeader>(sql, [
    data.user_id, data.legacy_user_id ?? null, data.name, data.nip ?? null, data.grade ?? null,
    data.position ?? null, data.organization_name ?? null, data.service_years ?? null,
    data.leave_type, data.duration, data.duration_unit ?? 'day', data.start_date, data.end_date,
    data.reason ?? null, data.address ?? null, data.phone ?? null,
    data.approver_1_name ?? null, data.approver_1_nip ?? null, data.approver_1_position ?? null,
    data.approver_2_name ?? null, data.approver_2_nip ?? null, data.approver_2_position ?? null,
    data.legacy_id ?? null, data.anomaly_flag ?? null,
  ]);
  return result.insertId;
};

export type LeaveRequestUpdate = Partial<NewLeaveRequest> & { status?: string };

export const updateLeaveRequest = async (
  id: number,
  data: LeaveRequestUpdate,
  executor: Executor = getMySql(),
): Promise<void> => {
  const columns = Object.keys(data);
  if (columns.length === 0) return;
  const assignments = columns.map((column) => `${column} = ?`).join(', ');
  const values = columns.map((column) => (data as Record<string, unknown>)[column] ?? null);
  await executor.query(`UPDATE leave_requests SET ${assignments} WHERE id = ?`, [...values, id]);
};

export const updateLeaveDecision = async (
  id: number,
  data: {
    status?: LeaveRequestRow['status'];
    admin_decision?: LeaveRequestRow['admin_decision'];
    approver_1_status?: LeaveRequestRow['approver_1_status'];
    approver_2_status?: LeaveRequestRow['approver_2_status'];
    admin_decided_by?: number | null;
    admin_decided_at?: string | null;
    approver_1_id?: number | null;
    approver_1_decided_at?: string | null;
    approver_2_id?: number | null;
    approver_2_decided_at?: string | null;
    rejection_reason?: string | null;
    /** Sisa cuti yang dicatat manual oleh admin (legacy `tahunan_n*`). */
    legacy_quota_n?: number | null;
    legacy_quota_n1?: number | null;
    legacy_quota_n2?: number | null;
    legacy_note_n?: string | null;
    legacy_note_n1?: string | null;
    legacy_note_n2?: string | null;
  },
  executor: Executor = getMySql(),
): Promise<void> => {
  const columns = Object.keys(data);
  if (columns.length === 0) return;
  const assignments = columns.map((column) => `${column} = ?`).join(', ');
  const values = columns.map((column) => (data as Record<string, unknown>)[column] ?? null);
  await executor.query(`UPDATE leave_requests SET ${assignments} WHERE id = ?`, [...values, id]);
};

export const deleteLeaveRequest = async (
  id: number,
  executor: Executor = getMySql(),
): Promise<void> => {
  await executor.execute('DELETE FROM leave_requests WHERE id = ?', [id]);
};

export const insertLeavePolicy = async (
  data: {
    year: number;
    default_days?: number;
    days_after_sk?: number;
    sk_applied?: number;
    sk_issued_at?: string | null;
    notes?: string | null;
    carry_over_max_n1?: number;
    carry_over_max_n2?: number;
    min_service_months?: number;
  },
  executor: Executor = getMySql(),
): Promise<number> => {
  const [result] = await executor.execute<import('mysql2/promise').ResultSetHeader>(
    `INSERT INTO leave_policies
       (year, default_days, days_after_sk, sk_applied, sk_issued_at, notes,
        carry_over_max_n1, carry_over_max_n2, min_service_months)
     VALUES (?,?,?,?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE
       default_days = VALUES(default_days),
       days_after_sk = VALUES(days_after_sk),
       sk_applied = VALUES(sk_applied),
       sk_issued_at = VALUES(sk_issued_at),
       notes = VALUES(notes),
       carry_over_max_n1 = VALUES(carry_over_max_n1),
       carry_over_max_n2 = VALUES(carry_over_max_n2),
       min_service_months = VALUES(min_service_months)`,
    [
      data.year, data.default_days ?? 12, data.days_after_sk ?? 12, data.sk_applied ?? 0,
      data.sk_issued_at ?? null, data.notes ?? null,
      data.carry_over_max_n1 ?? 6, data.carry_over_max_n2 ?? 6, data.min_service_months ?? 12,
    ],
  );
  return result.insertId;
};

export const upsertLeaveQuota = async (
  data: {
    user_id: number;
    year: number;
    quota_n: number;
    quota_n1: number;
    quota_n2: number;
    total_quota: number;
    used_n: number;
    used_n1: number;
    used_n2: number;
    total_used: number;
    remaining_n: number;
    remaining_n1: number;
    remaining_n2: number;
    total_remaining: number;
    reserved_days: number;
    reserved_count: number;
    eligible: boolean;
    months_worked: number | null;
    tmt_year: number | null;
    tmt_month: number | null;
    manual_validation: boolean;
  },
  executor: Executor = getMySql(),
): Promise<void> => {
  await executor.execute(
    `INSERT INTO leave_quotas
       (user_id, year, quota_n, quota_n1, quota_n2, total_quota,
        used_n, used_n1, used_n2, total_used,
        remaining_n, remaining_n1, remaining_n2, total_remaining,
        reserved_days, reserved_count, eligible, months_worked,
        tmt_year, tmt_month, manual_validation, computed_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW())
     ON DUPLICATE KEY UPDATE
       quota_n = VALUES(quota_n), quota_n1 = VALUES(quota_n1), quota_n2 = VALUES(quota_n2),
       total_quota = VALUES(total_quota),
       used_n = VALUES(used_n), used_n1 = VALUES(used_n1), used_n2 = VALUES(used_n2),
       total_used = VALUES(total_used),
       remaining_n = VALUES(remaining_n), remaining_n1 = VALUES(remaining_n1),
       remaining_n2 = VALUES(remaining_n2), total_remaining = VALUES(total_remaining),
       reserved_days = VALUES(reserved_days), reserved_count = VALUES(reserved_count),
       eligible = VALUES(eligible), months_worked = VALUES(months_worked),
       tmt_year = VALUES(tmt_year), tmt_month = VALUES(tmt_month),
       manual_validation = VALUES(manual_validation), computed_at = NOW()`,
    [
      data.user_id, data.year, data.quota_n, data.quota_n1, data.quota_n2, data.total_quota,
      data.used_n, data.used_n1, data.used_n2, data.total_used,
      data.remaining_n, data.remaining_n1, data.remaining_n2, data.total_remaining,
      data.reserved_days, data.reserved_count,
      data.eligible ? 1 : 0, data.months_worked,
      data.tmt_year, data.tmt_month, data.manual_validation ? 1 : 0,
    ],
  );
};

export const insertLeaveQuotaAudit = async (
  data: {
    user_id: number;
    quota_id?: number | null;
    leave_request_id?: number | null;
    year?: number | null;
    action: string;
    before_data?: unknown;
    after_data?: unknown;
    difference?: number | null;
    actor_id?: number | null;
    reason?: string | null;
  },
  executor: Executor = getMySql(),
): Promise<void> => {
  await executor.execute(
    `INSERT INTO leave_quota_audits
       (user_id, quota_id, leave_request_id, year, action, before_data, after_data, difference, actor_id, reason)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      data.user_id, data.quota_id ?? null, data.leave_request_id ?? null, data.year ?? null,
      data.action,
      data.before_data === undefined ? null : JSON.stringify(data.before_data),
      data.after_data === undefined ? null : JSON.stringify(data.after_data),
      data.difference ?? null, data.actor_id ?? null, data.reason ?? null,
    ],
  );
};

// ---------------------------------------------------------------------------
// Periode tutup tahunan
// ---------------------------------------------------------------------------

export const insertClosurePeriod = async (
  data: {
    year: number;
    start_date: string;
    end_date: string;
    enabled?: boolean;
    message?: string | null;
    actor_id?: number | null;
  },
  executor: Executor = getMySql(),
): Promise<number> => {
  const [result] = await executor.execute<import('mysql2/promise').ResultSetHeader>(
    `INSERT INTO leave_closure_periods (year, start_date, end_date, enabled, message, created_by, updated_by)
     VALUES (?,?,?,?,?,?,?)`,
    [
      data.year, data.start_date, data.end_date, data.enabled === false ? 0 : 1,
      data.message ?? null, data.actor_id ?? null, data.actor_id ?? null,
    ],
  );
  return result.insertId;
};

export const updateClosurePeriod = async (
  id: number,
  data: {
    year?: number;
    start_date?: string;
    end_date?: string;
    enabled?: boolean;
    message?: string | null;
    actor_id?: number | null;
  },
  executor: Executor = getMySql(),
): Promise<void> => {
  const columns: string[] = [];
  const values: unknown[] = [];
  if (data.year !== undefined) { columns.push('year = ?'); values.push(data.year); }
  if (data.start_date !== undefined) { columns.push('start_date = ?'); values.push(data.start_date); }
  if (data.end_date !== undefined) { columns.push('end_date = ?'); values.push(data.end_date); }
  if (data.enabled !== undefined) { columns.push('enabled = ?'); values.push(data.enabled ? 1 : 0); }
  if (data.message !== undefined) { columns.push('message = ?'); values.push(data.message); }
  if (data.actor_id !== undefined) { columns.push('updated_by = ?'); values.push(data.actor_id); }
  if (columns.length === 0) return;
  await executor.query(
    `UPDATE leave_closure_periods SET ${columns.join(', ')} WHERE id = ?`,
    [...values, id],
  );
};

export const deleteClosurePeriod = async (
  id: number,
  executor: Executor = getMySql(),
): Promise<void> => {
  await executor.execute('DELETE FROM leave_closure_periods WHERE id = ?', [id]);
};

// ---------------------------------------------------------------------------
// Surat keterangan cuti
// ---------------------------------------------------------------------------

export const upsertLeaveLetter = async (
  data: {
    leave_request_id: number;
    letter_type: 'suket' | 'suket_madrasah';
    number?: string | null;
    issued_at?: string | null;
    official_position?: string | null;
    official_name?: string | null;
    document_id?: number | null;
    legacy_id?: string | null;
    created_by?: number | null;
  },
  executor: Executor = getMySql(),
): Promise<number> => {
  const [result] = await executor.execute<import('mysql2/promise').ResultSetHeader>(
    `INSERT INTO leave_letters
       (leave_request_id, letter_type, number, issued_at, official_position, official_name,
        document_id, legacy_id, created_by)
     VALUES (?,?,?,?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE
       number = VALUES(number),
       issued_at = VALUES(issued_at),
       official_position = VALUES(official_position),
       official_name = VALUES(official_name),
       document_id = VALUES(document_id)`,
    [
      data.leave_request_id, data.letter_type, data.number ?? null, data.issued_at ?? null,
      data.official_position ?? null, data.official_name ?? null,
      data.document_id ?? null, data.legacy_id ?? null, data.created_by ?? null,
    ],
  );
  return result.insertId;
};

export const deleteLeaveLetter = async (
  leaveRequestId: number,
  letterType: 'suket' | 'suket_madrasah',
  executor: Executor = getMySql(),
): Promise<void> => {
  await executor.execute(
    'DELETE FROM leave_letters WHERE leave_request_id = ? AND letter_type = ?',
    [leaveRequestId, letterType],
  );
};

/**
 * Nomor surat berikutnya untuk (jenis, tahun).
 *
 * Satu statement: INSERT ... ON DUPLICATE KEY UPDATE menaikkan penghitung dan
 * menaruh nilainya di LAST_INSERT_ID(expr), lalu dibaca dalam panggilan yang
 * sama. Dua penerbitan bersamaan karena itu tidak mungkin mendapat nomor yang
 * sama — pembacaan-lalu-penulisan terpisah akan bisa.
 */
export const nextLeaveLetterNumber = async (
  letterType: 'suket' | 'suket_madrasah',
  year: number,
  executor: Executor = getMySql(),
): Promise<number> => {
  const [result] = await executor.query<import('mysql2/promise').ResultSetHeader>(
    `INSERT INTO leave_letter_counters (letter_type, year, last_number)
     VALUES (?, ?, LAST_INSERT_ID(1))
     ON DUPLICATE KEY UPDATE last_number = LAST_INSERT_ID(last_number + 1)`,
    [letterType, year],
  );
  return Number(result.insertId ?? 1);
};

// ---------------------------------------------------------------------------
// Pengaturan instansi, TMT PPPK, audit umum
// ---------------------------------------------------------------------------

export const upsertSetting = async (
  key: string,
  value: string | null,
  description?: string | null,
  executor: Executor = getMySql(),
): Promise<void> => {
  await executor.execute(
    `INSERT INTO settings (\`key\`, value, description, updated_at)
     VALUES (?,?,?,NOW())
     ON DUPLICATE KEY UPDATE value = VALUES(value),
       description = COALESCE(VALUES(description), description),
       updated_at = NOW()`,
    [key, value, description ?? null],
  );
};

export const deleteSetting = async (key: string, executor: Executor = getMySql()): Promise<void> => {
  await executor.execute('DELETE FROM settings WHERE `key` = ?', [key]);
};

export const insertAuditLog = async (
  data: {
    actor_id?: number | null;
    action: string;
    entity_table: string;
    entity_id?: number | null;
    before_data?: unknown;
    after_data?: unknown;
    ip_address?: string | null;
  },
  executor: Executor = getMySql(),
): Promise<void> => {
  await executor.execute(
    `INSERT INTO audit_logs (actor_id, action, entity_table, entity_id, before_data, after_data, ip_address)
     VALUES (?,?,?,?,?,?,?)`,
    [
      data.actor_id ?? null, data.action, data.entity_table, data.entity_id ?? null,
      data.before_data === undefined ? null : JSON.stringify(data.before_data),
      data.after_data === undefined ? null : JSON.stringify(data.after_data),
      data.ip_address ?? null,
    ],
  );
};

// ---------------------------------------------------------------------------
// Penyesuaian kuota manual admin
// ---------------------------------------------------------------------------

export const insertQuotaAdjustment = async (
  data: {
    user_id: number;
    year: number;
    days: number;
    /** Bucket tujuan koreksi; legacy menyunting ketiga tahun sekaligus. */
    bucket?: 'n' | 'n1' | 'n2';
    reason?: string | null;
    actor_id?: number | null;
  },
  executor: Executor = getMySql(),
): Promise<number> => {
  const [result] = await executor.execute<import('mysql2/promise').ResultSetHeader>(
    `INSERT INTO leave_quota_adjustments (user_id, year, bucket, days, reason, actor_id)
     VALUES (?,?,?,?,?,?)`,
    [
      data.user_id,
      data.year,
      data.bucket ?? 'n',
      data.days,
      data.reason ?? null,
      data.actor_id ?? null,
    ],
  );
  return result.insertId;
};

/** Riwayat cuti pra-2020; hanya diisi oleh migrasi, tidak oleh alur aplikasi. */
export const insertLeaveLegacyHistory = async (
  data: {
    user_id: number;
    legacy_id: string;
    year: number;
    leave_type: string;
    duration: number;
    duration_unit: string;
    start_date?: string | null;
    end_date?: string | null;
    number?: string | null;
    issued_at?: string | null;
    source_table?: string;
  },
  executor: Executor = getMySql(),
): Promise<void> => {
  await executor.execute(
    `INSERT INTO leave_legacy_history
       (user_id, legacy_id, year, leave_type, duration, duration_unit,
        start_date, end_date, number, issued_at, source_table)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE
       user_id = VALUES(user_id), year = VALUES(year), leave_type = VALUES(leave_type),
       duration = VALUES(duration), duration_unit = VALUES(duration_unit),
       start_date = VALUES(start_date), end_date = VALUES(end_date),
       number = VALUES(number), issued_at = VALUES(issued_at)`,
    [
      data.user_id,
      data.legacy_id,
      data.year,
      data.leave_type,
      data.duration,
      data.duration_unit,
      data.start_date ?? null,
      data.end_date ?? null,
      data.number ?? null,
      data.issued_at ?? null,
      data.source_table ?? 'tbl_n2019',
    ],
  );
};

export const deleteQuotaAdjustment = async (
  id: number,
  executor: Executor = getMySql(),
): Promise<void> => {
  await executor.execute('DELETE FROM leave_quota_adjustments WHERE id = ?', [id]);
};

/**
 * Catat atau batalkan pernyataan layak manual admin.
 * Disimpan di `settings` dengan kunci `leave_override:{user}:{year}` supaya
 * tidak perlu tabel baru hanya untuk satu penanda.
 */
export const setEligibilityOverride = async (
  userId: number,
  year: number,
  data: { active: boolean; reason?: string | null },
  executor: Executor = getMySql(),
): Promise<void> => {
  const key = `leave_override:${userId}:${year}`;
  if (!data.active) {
    await executor.execute('DELETE FROM settings WHERE `key` = ?', [key]);
    return;
  }
  await executor.execute(
    `INSERT INTO settings (\`key\`, value, description, updated_at)
     VALUES (?,?,?,NOW())
     ON DUPLICATE KEY UPDATE value = VALUES(value), description = VALUES(description), updated_at = NOW()`,
    [key, 'eligible', data.reason ?? 'Validasi manual admin'],
  );
};
