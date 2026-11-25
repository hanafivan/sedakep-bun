import { getMySql } from '../../../db/mysql';
import { rows, type Executor } from '../../../shared/db';
import type { AgendaRow } from '../schema/types';

/**
 * QUERY = operasi baca modul agenda. Semua SELECT ada di sini.
 * Tidak ada logika bisnis di file ini.
 */

export { findInstanceProfile, findUserProfileById } from '../../../shared/db';

export const findAgendas = async (
  filter: {
    userId?: number;
    year?: number;
    month?: number;
    search?: string;
    limit?: number;
    offset?: number;
  },
  executor: Executor = getMySql(),
): Promise<AgendaRow[]> => {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.userId) {
    where.push('user_id = ?');
    params.push(filter.userId);
  }
  if (filter.year) {
    where.push('YEAR(start_at) = ?');
    params.push(filter.year);
  }
  if (filter.month) {
    where.push('MONTH(start_at) = ?');
    params.push(filter.month);
  }
  if (filter.search) {
    where.push('(title LIKE ? OR name LIKE ? OR nip LIKE ? OR place LIKE ? OR CAST(id AS CHAR) = ?)');
    const like = `%${filter.search}%`;
    params.push(like, like, like, like, filter.search);
  }
  params.push(
    Math.min(Math.max(filter.limit ?? 25, 1), 200),
    Math.max(filter.offset ?? 0, 0),
  );
  return rows<AgendaRow>(
    executor,
    `SELECT * FROM agendas
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY start_at DESC, id DESC
      LIMIT ? OFFSET ?`,
    params,
  );
};

export const countAgendas = async (
  filter: { userId?: number; year?: number; month?: number; search?: string },
  executor: Executor = getMySql(),
): Promise<number> => {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.userId) {
    where.push('user_id = ?');
    params.push(filter.userId);
  }
  if (filter.year) {
    where.push('YEAR(start_at) = ?');
    params.push(filter.year);
  }
  if (filter.month) {
    where.push('MONTH(start_at) = ?');
    params.push(filter.month);
  }
  if (filter.search) {
    where.push('(title LIKE ? OR name LIKE ? OR nip LIKE ? OR place LIKE ? OR CAST(id AS CHAR) = ?)');
    const like = `%${filter.search}%`;
    params.push(like, like, like, like, filter.search);
  }
  const result = await rows<{ total: number }>(
    executor,
    `SELECT COUNT(*) AS total FROM agendas ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`,
    params,
  );
  return Number(result[0]?.total ?? 0);
};

export const findAgendaById = async (
  id: number,
  executor: Executor = getMySql(),
): Promise<AgendaRow | null> => {
  const result = await rows<AgendaRow>(executor, 'SELECT * FROM agendas WHERE id = ? LIMIT 1', [id]);
  return result[0] ?? null;
};

/** Profil user & instansi (kop cetak agenda) — re-exported dari shared/db. */
