import { getMySql } from '../../../db/mysql';
import type { Executor } from '../../../shared/db';
import { rows } from '../../../shared/db';
import type { AlibiRequestRow } from '../schema/types';

/**
 * QUERY = operasi baca modul alibi. Semua SELECT ada di sini.
 * Tidak ada logika bisnis di file ini.
 */

export { findInstanceProfile, findUserNipById, findUserProfileById } from '../../../shared/db';
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

/** Identitas instansi, NIP, dan profil pegawai — re-exported dari shared/db. */

export const findAlibiRequestsForExport = async (
  filter: {
    startDate?: string;
    endDate?: string;
    status?: string;
    search?: string;
    userId?: number;
  },
  executor: Executor = getMySql(),
): Promise<AlibiRequestRow[]> => {
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
  if (filter.startDate) {
    where.push('alibi_date >= ?');
    params.push(filter.startDate);
  }
  if (filter.endDate) {
    where.push('alibi_date <= ?');
    params.push(filter.endDate);
  }
  if (filter.search) {
    where.push('(name LIKE ? OR nip LIKE ? OR alibi_type LIKE ?)');
    const like = `%${filter.search}%`;
    params.push(like, like, like);
  }

  return rows<AlibiRequestRow>(
    executor,
    `SELECT * FROM alibi_requests
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY alibi_date ASC, id ASC`,
    params,
  );
};
