import type { Pool, PoolConnection } from 'mysql2/promise';
import { getMySql } from '../../../db/mysql';

/**
 * COMMAND = operasi tulis modul alibi. Semua INSERT/UPDATE/DELETE ada di sini.
 * Tidak ada logika bisnis di file ini.
 */

export type Executor = Pool | PoolConnection;

export type NewAlibiRequest = {
  user_id: number;
  legacy_id?: string | null;
  name: string;
  nip?: string | null;
  grade?: string | null;
  position?: string | null;
  organization_name?: string | null;
  day_count?: string | null;
  alibi_date?: string | null;
  alibi_type?: string | null;
  reason?: string | null;
  time_start?: string | null;
  time_end?: string | null;
  approver_1_name?: string | null;
  approver_1_nip?: string | null;
  approver_1_position?: string | null;
  approver_2_name?: string | null;
  approver_2_nip?: string | null;
  approver_2_position?: string | null;
};

export const insertAlibiRequest = async (
  data: NewAlibiRequest,
  executor: Executor = getMySql(),
): Promise<number> => {
  const [result] = await executor.execute<import('mysql2/promise').ResultSetHeader>(
    `INSERT INTO alibi_requests (
       user_id, legacy_id, name, nip, grade, position, organization_name,
       day_count, alibi_date, alibi_type, reason, time_start, time_end,
       approver_1_name, approver_1_nip, approver_1_position,
       approver_2_name, approver_2_nip, approver_2_position
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      data.user_id, data.legacy_id ?? null, data.name, data.nip ?? null, data.grade ?? null,
      data.position ?? null, data.organization_name ?? null,
      data.day_count ?? null, data.alibi_date ?? null, data.alibi_type ?? null,
      data.reason ?? null, data.time_start ?? null, data.time_end ?? null,
      data.approver_1_name ?? null, data.approver_1_nip ?? null, data.approver_1_position ?? null,
      data.approver_2_name ?? null, data.approver_2_nip ?? null, data.approver_2_position ?? null,
    ],
  );
  return result.insertId;
};

const ALIBI_COLUMNS: Record<string, string> = {
  day_count: 'day_count',
  alibi_date: 'alibi_date',
  alibi_type: 'alibi_type',
  reason: 'reason',
  time_start: 'time_start',
  time_end: 'time_end',
  approver_1_name: 'approver_1_name',
  approver_1_nip: 'approver_1_nip',
  approver_1_position: 'approver_1_position',
  approver_2_name: 'approver_2_name',
  approver_2_nip: 'approver_2_nip',
  approver_2_position: 'approver_2_position',
};

export const updateAlibiRequest = async (
  id: number,
  data: Record<string, unknown>,
  executor: Executor = getMySql(),
): Promise<void> => {
  const columns: string[] = [];
  const values: unknown[] = [];
  for (const [key, column] of Object.entries(ALIBI_COLUMNS)) {
    if (data[key] !== undefined) {
      columns.push(`${column} = ?`);
      values.push(data[key]);
    }
  }
  if (columns.length === 0) return;
  await executor.query(
    `UPDATE alibi_requests SET ${columns.join(', ')} WHERE id = ?`,
    [...values, id],
  );
};

const DECISION_COLUMNS = [
  'status',
  'admin_decision',
  'admin_decided_at',
  'approver_1_status',
  'approver_1_decided_at',
  'approver_2_status',
  'approver_2_decided_at',
  'verdict_note',
];

export const updateAlibiDecision = async (
  id: number,
  data: Record<string, unknown>,
  executor: Executor = getMySql(),
): Promise<void> => {
  const columns: string[] = [];
  const values: unknown[] = [];
  for (const key of DECISION_COLUMNS) {
    if (data[key] !== undefined) {
      columns.push(`${key} = ?`);
      values.push(data[key]);
    }
  }
  if (columns.length === 0) return;
  await executor.query(
    `UPDATE alibi_requests SET ${columns.join(', ')} WHERE id = ?`,
    [...values, id],
  );
};

export const deleteAlibiRequest = async (
  id: number,
  executor: Executor = getMySql(),
): Promise<void> => {
  await executor.execute('DELETE FROM alibi_requests WHERE id = ?', [id]);
};

export const markAlibiPrinted = async (
  id: number,
  printedAt: string,
  executor: Executor = getMySql(),
): Promise<void> => {
  await executor.execute('UPDATE alibi_requests SET printed_at = ? WHERE id = ?', [printedAt, id]);
};

export const insertAuditLog = async (
  data: {
    actor_id?: number | null;
    action: string;
    entity_table: string;
    entity_id?: number | null;
    before_data?: unknown;
    after_data?: unknown;
  },
  executor: Executor = getMySql(),
): Promise<void> => {
  await executor.execute(
    `INSERT INTO audit_logs (actor_id, action, entity_table, entity_id, before_data, after_data)
     VALUES (?,?,?,?,?,?)`,
    [
      data.actor_id ?? null,
      data.action,
      data.entity_table,
      data.entity_id ?? null,
      data.before_data === undefined ? null : JSON.stringify(data.before_data),
      data.after_data === undefined ? null : JSON.stringify(data.after_data),
    ],
  );
};
