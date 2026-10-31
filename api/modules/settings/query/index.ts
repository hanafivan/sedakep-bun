import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { getMySql } from '../../../db/mysql';
import type { SettingRow } from '../schema/types';

/** QUERY = operasi baca modul pengaturan. Tanpa logika bisnis. */

type Executor = Pool | PoolConnection;

const rows = async <T>(executor: Executor, sql: string, params: unknown[] = []): Promise<T[]> => {
  const [result] = await executor.query<RowDataPacket[]>(sql, params);
  return result as unknown as T[];
};

export const findSettings = async (
  filter: { prefix?: string; search?: string } = {},
  executor: Executor = getMySql(),
): Promise<SettingRow[]> => {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.prefix) {
    where.push('`key` LIKE ?');
    params.push(`${filter.prefix}%`);
  }
  if (filter.search) {
    where.push('(`key` LIKE ? OR description LIKE ?)');
    const like = `%${filter.search}%`;
    params.push(like, like);
  }
  return rows<SettingRow>(
    executor,
    `SELECT id, \`key\`, value, description, updated_at FROM settings
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY \`key\` ASC`,
    params,
  );
};

export const findSettingByKey = async (
  key: string,
  executor: Executor = getMySql(),
): Promise<SettingRow | null> => {
  const result = await rows<SettingRow>(
    executor,
    'SELECT id, `key`, value, description, updated_at FROM settings WHERE `key` = ? LIMIT 1',
    [key],
  );
  return result[0] ?? null;
};

export const findSettingsByPrefix = async (
  prefix: string,
  executor: Executor = getMySql(),
): Promise<SettingRow[]> => findSettings({ prefix }, executor);
