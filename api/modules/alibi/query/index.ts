import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { getMySql } from '../../../db/mysql';
import type { AlibiRequestRow } from '../schema/types';

/**
 * QUERY = operasi baca modul alibi. Semua SELECT ada di sini.
 * Tidak ada logika bisnis di file ini.
 */

type Executor = Pool | PoolConnection;

const rows = async <T>(executor: Executor, sql: string, params: unknown[] = []): Promise<T[]> => {
  const [result] = await executor.query<RowDataPacket[]>(sql, params);
  return result as unknown as T[];
};

export type AlibiListRow = AlibiRequestRow;

export const findAlibiRequests = async (
  filter: {
    userId?: number;
    status?: string;
    year?: number;
    search?: string;
    limit?: number;
    offset?: number;
  },
  executor: Executor = getMySql(),
): Promise<AlibiListRow[]> => {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filter.userId) {
    where.push('user_id = ?');
    params.push(filter.userId);
  }
  if (filter.status) {
    where.push('status = ?');
    params.push(filter.status);
  }
  if (filter.year) {
    where.push('YEAR(alibi_date) = ?');
    params.push(filter.year);
  }
  if (filter.search) {
    where.push('(name LIKE ? OR nip LIKE ? OR alibi_type LIKE ? OR CAST(id AS CHAR) = ?)');
    const like = `%${filter.search}%`;
    params.push(like, like, like, filter.search);
  }

  const limit = Math.min(Math.max(filter.limit ?? 25, 1), 200);
  const offset = Math.max(filter.offset ?? 0, 0);
  params.push(limit, offset);

  return rows<AlibiListRow>(
    executor,
    `SELECT * FROM alibi_requests
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY alibi_date DESC, id DESC
      LIMIT ? OFFSET ?`,
    params,
  );
};

export const countAlibiRequests = async (
  filter: { userId?: number; status?: string; year?: number; search?: string },
  executor: Executor = getMySql(),
): Promise<number> => {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filter.userId) {
    where.push('user_id = ?');
    params.push(filter.userId);
  }
  if (filter.status) {
    where.push('status = ?');
    params.push(filter.status);
  }
  if (filter.year) {
    where.push('YEAR(alibi_date) = ?');
    params.push(filter.year);
  }
  if (filter.search) {
    where.push('(name LIKE ? OR nip LIKE ? OR alibi_type LIKE ? OR CAST(id AS CHAR) = ?)');
    const like = `%${filter.search}%`;
    params.push(like, like, like, filter.search);
  }

  const result = await rows<{ total: number }>(
    executor,
    `SELECT COUNT(*) AS total FROM alibi_requests
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`,
    params,
  );
  return Number(result[0]?.total ?? 0);
};

export const findAlibiRequestById = async (
  id: number,
  executor: Executor = getMySql(),
): Promise<AlibiRequestRow | null> => {
  const result = await rows<AlibiRequestRow>(
    executor,
    'SELECT * FROM alibi_requests WHERE id = ? LIMIT 1',
    [id],
  );
  return result[0] ?? null;
};

export const findUserNipById = async (
  userId: number,
  executor: Executor = getMySql(),
): Promise<string | null> => {
  const result = await rows<{ nip: string | null }>(
    executor,
    'SELECT nip FROM users WHERE id = ? LIMIT 1',
    [userId],
  );
  return result[0]?.nip ?? null;
};

export const findUserProfileById = async (
  userId: number,
  executor: Executor = getMySql(),
): Promise<{
  id: number;
  name: string;
  nip: string | null;
  grade: string | null;
  unit_name: string | null;
  position_name: string | null;
  organization_name: string | null;
} | null> => {
  const result = await rows<{
    id: number;
    name: string;
    nip: string | null;
    grade: string | null;
    unit_name: string | null;
    position_name: string | null;
    organization_name: string | null;
  }>(
    executor,
    `SELECT u.id, u.name, u.nip, u.grade, u.unit_name,
            p.name AS position_name, o.name AS organization_name
       FROM users u
       LEFT JOIN positions p ON p.id = u.position_id
       LEFT JOIN organizations o ON o.id = u.organization_id
      WHERE u.id = ? LIMIT 1`,
    [userId],
  );
  return result[0] ?? null;
};

/** Identitas instansi (kop cetak alibi) tersimpan sebagai settings `instance.*`. */
export const findInstanceProfile = async (
  executor: Executor = getMySql(),
): Promise<Record<string, string | null>> => {
  const result = await rows<{ key: string; value: string | null }>(
    executor,
    "SELECT `key`, value FROM settings WHERE `key` LIKE 'instance.%'",
  );
  const profile: Record<string, string | null> = {};
  for (const row of result) {
    profile[row.key.replace(/^instance\./, '')] = row.value;
  }
  return profile;
};
