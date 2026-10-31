import type { Pool, PoolConnection } from 'mysql2/promise';
import { getMySql } from '../../../db/mysql';

/**
 * COMMAND = operasi tulis modul agenda. Tidak ada logika bisnis di file ini.
 */

export type Executor = Pool | PoolConnection;

export type NewAgenda = {
  user_id: number;
  legacy_id?: string | null;
  name?: string | null;
  nip?: string | null;
  title: string;
  place?: string | null;
  start_at?: string | null;
  end_at?: string | null;
  report?: string | null;
};

export const insertAgenda = async (
  data: NewAgenda,
  executor: Executor = getMySql(),
): Promise<number> => {
  const [result] = await executor.execute<import('mysql2/promise').ResultSetHeader>(
    `INSERT INTO agendas (user_id, legacy_id, name, nip, title, place, start_at, end_at, report, reported_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      data.user_id,
      data.legacy_id ?? null,
      data.name ?? null,
      data.nip ?? null,
      data.title,
      data.place ?? null,
      data.start_at ?? null,
      data.end_at ?? null,
      data.report ?? null,
      data.report ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null,
    ],
  );
  return result.insertId;
};

const AGENDA_COLUMNS = ['name', 'nip', 'title', 'place', 'start_at', 'end_at', 'report'];

export const updateAgenda = async (
  id: number,
  data: Record<string, unknown>,
  executor: Executor = getMySql(),
): Promise<void> => {
  const columns: string[] = [];
  const values: unknown[] = [];
  for (const key of AGENDA_COLUMNS) {
    if (data[key] !== undefined) {
      columns.push(`${key} = ?`);
      values.push(data[key]);
    }
  }
  if (columns.length === 0) return;
  await executor.query(`UPDATE agendas SET ${columns.join(', ')} WHERE id = ?`, [...values, id]);
};

export const setAgendaReport = async (
  id: number,
  report: string,
  executor: Executor = getMySql(),
): Promise<void> => {
  await executor.execute('UPDATE agendas SET report = ?, reported_at = NOW() WHERE id = ?', [
    report,
    id,
  ]);
};

export const deleteAgenda = async (id: number, executor: Executor = getMySql()): Promise<void> => {
  await executor.execute('DELETE FROM agendas WHERE id = ?', [id]);
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
