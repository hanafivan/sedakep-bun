import type { Pool, PoolConnection } from 'mysql2/promise';
import { getMySql } from '../../../db/mysql';

/** COMMAND = operasi tulis master data. Tanpa logika bisnis. */

export type Executor = Pool | PoolConnection;

export const insertOrganization = async (
  data: { code: string; name: string; parent_id?: number | null; level?: number; is_active?: number },
  executor: Executor = getMySql(),
): Promise<number> => {
  const [result] = await executor.execute<import('mysql2/promise').ResultSetHeader>(
    'INSERT INTO organizations (code, name, parent_id, level, is_active) VALUES (?,?,?,?,?)',
    [data.code, data.name, data.parent_id ?? null, data.level ?? 1, data.is_active ?? 1],
  );
  return result.insertId;
};

export const updateOrganization = async (
  id: number,
  data: Record<string, unknown>,
  executor: Executor = getMySql(),
): Promise<void> => {
  const columns: string[] = [];
  const values: unknown[] = [];
  for (const key of ['code', 'name', 'parent_id', 'level', 'is_active']) {
    if (data[key] !== undefined) {
      columns.push(`${key} = ?`);
      values.push(data[key]);
    }
  }
  if (columns.length === 0) return;
  await executor.query(`UPDATE organizations SET ${columns.join(', ')} WHERE id = ?`, [...values, id]);
};

export const deleteOrganization = async (id: number, executor: Executor = getMySql()): Promise<void> => {
  await executor.execute('DELETE FROM organizations WHERE id = ?', [id]);
};

export const insertPosition = async (
  data: { name: string; grade?: string | null; is_active?: number },
  executor: Executor = getMySql(),
): Promise<number> => {
  const [result] = await executor.execute<import('mysql2/promise').ResultSetHeader>(
    'INSERT INTO positions (name, grade, is_active) VALUES (?,?,?)',
    [data.name, data.grade ?? null, data.is_active ?? 1],
  );
  return result.insertId;
};

export const updatePosition = async (
  id: number,
  data: { name?: string; grade?: string | null; is_active?: number },
  executor: Executor = getMySql(),
): Promise<void> => {
  const columns: string[] = [];
  const values: unknown[] = [];
  for (const key of ['name', 'grade', 'is_active'] as const) {
    if (data[key] !== undefined) {
      columns.push(`${key} = ?`);
      values.push(data[key]);
    }
  }
  if (columns.length === 0) return;
  await executor.query(`UPDATE positions SET ${columns.join(', ')} WHERE id = ?`, [...values, id]);
};

export const deletePosition = async (id: number, executor: Executor = getMySql()): Promise<void> => {
  await executor.execute('DELETE FROM positions WHERE id = ?', [id]);
};
