import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { getMySql } from '../../../db/mysql';
import type {
  AssignmentCopyRow,
  AssignmentLetterRow,
  AssignmentMemberRow,
  AssignmentNoteRow,
} from '../schema/types';

/**
 * QUERY = operasi baca modul surat tugas. Semua SELECT ada di sini.
 * Tidak ada logika bisnis di file ini.
 */

type Executor = Pool | PoolConnection;

const rows = async <T>(executor: Executor, sql: string, params: unknown[] = []): Promise<T[]> => {
  const [result] = await executor.query<RowDataPacket[]>(sql, params);
  return result as unknown as T[];
};

export type AssignmentLetterListRow = AssignmentLetterRow & { name: string; nip: string | null };

export const findAssignmentLetters = async (
  filter: {
    userId?: number;
    status?: string;
    year?: number;
    search?: string;
    limit?: number;
    offset?: number;
  },
  executor: Executor = getMySql(),
): Promise<AssignmentLetterListRow[]> => {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filter.userId) {
    where.push('l.user_id = ?');
    params.push(filter.userId);
  }
  if (filter.status) {
    where.push('l.status = ?');
    params.push(filter.status);
  }
  if (filter.year) {
    where.push('YEAR(l.start_date) = ?');
    params.push(filter.year);
  }
  if (filter.search) {
    where.push(
      '(l.letter_number LIKE ? OR l.code LIKE ? OR u.name LIKE ? OR u.nip LIKE ? OR CAST(l.id AS CHAR) = ?)',
    );
    const like = `%${filter.search}%`;
    params.push(like, like, like, like, filter.search);
  }

  const limit = Math.min(Math.max(filter.limit ?? 25, 1), 200);
  const offset = Math.max(filter.offset ?? 0, 0);
  params.push(limit, offset);

  return rows<AssignmentLetterListRow>(
    executor,
    `SELECT l.*, u.name, u.nip
       FROM assignment_letters l
       JOIN users u ON u.id = l.user_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY l.created_at DESC, l.id DESC
      LIMIT ? OFFSET ?`,
    params,
  );
};

export const countAssignmentLetters = async (
  filter: { userId?: number; status?: string; year?: number; search?: string },
  executor: Executor = getMySql(),
): Promise<number> => {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filter.userId) {
    where.push('l.user_id = ?');
    params.push(filter.userId);
  }
  if (filter.status) {
    where.push('l.status = ?');
    params.push(filter.status);
  }
  if (filter.year) {
    where.push('YEAR(l.start_date) = ?');
    params.push(filter.year);
  }
  if (filter.search) {
    where.push(
      '(l.letter_number LIKE ? OR l.code LIKE ? OR u.name LIKE ? OR u.nip LIKE ? OR CAST(l.id AS CHAR) = ?)',
    );
    const like = `%${filter.search}%`;
    params.push(like, like, like, like, filter.search);
  }

  const result = await rows<{ total: number }>(
    executor,
    `SELECT COUNT(*) AS total
       FROM assignment_letters l
       JOIN users u ON u.id = l.user_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`,
    params,
  );
  return Number(result[0]?.total ?? 0);
};

export const findAssignmentLetterById = async (
  id: number,
  executor: Executor = getMySql(),
): Promise<AssignmentLetterRow | null> => {
  const result = await rows<AssignmentLetterRow>(
    executor,
    'SELECT * FROM assignment_letters WHERE id = ? LIMIT 1',
    [id],
  );
  return result[0] ?? null;
};

export const findAssignmentMembers = async (
  letterId: number,
  executor: Executor = getMySql(),
): Promise<AssignmentMemberRow[]> =>
  rows<AssignmentMemberRow>(
    executor,
    'SELECT * FROM assignment_members WHERE letter_id = ? ORDER BY sort_order ASC, id ASC',
    [letterId],
  );

export const findAssignmentNotes = async (
  letterId: number,
  executor: Executor = getMySql(),
): Promise<AssignmentNoteRow[]> =>
  rows<AssignmentNoteRow>(
    executor,
    'SELECT * FROM assignment_notes WHERE letter_id = ? ORDER BY sort_order ASC, id ASC',
    [letterId],
  );

export const findAssignmentCopies = async (
  letterId: number,
  executor: Executor = getMySql(),
): Promise<AssignmentCopyRow[]> =>
  rows<AssignmentCopyRow>(
    executor,
    'SELECT * FROM assignment_copies WHERE letter_id = ? ORDER BY sort_order ASC, id ASC',
    [letterId],
  );

export const findAssignmentMemberById = async (
  id: number,
  executor: Executor = getMySql(),
): Promise<AssignmentMemberRow | null> => {
  const result = await rows<AssignmentMemberRow>(
    executor,
    'SELECT * FROM assignment_members WHERE id = ? LIMIT 1',
    [id],
  );
  return result[0] ?? null;
};

export const findAssignmentNoteById = async (
  id: number,
  executor: Executor = getMySql(),
): Promise<AssignmentNoteRow | null> => {
  const result = await rows<AssignmentNoteRow>(
    executor,
    'SELECT * FROM assignment_notes WHERE id = ? LIMIT 1',
    [id],
  );
  return result[0] ?? null;
};

export const findAssignmentCopyById = async (
  id: number,
  executor: Executor = getMySql(),
): Promise<AssignmentCopyRow | null> => {
  const result = await rows<AssignmentCopyRow>(
    executor,
    'SELECT * FROM assignment_copies WHERE id = ? LIMIT 1',
    [id],
  );
  return result[0] ?? null;
};

export const findUserIdentityById = async (
  userId: number,
  executor: Executor = getMySql(),
): Promise<{ id: number; name: string; nip: string | null } | null> => {
  const result = await rows<{ id: number; name: string; nip: string | null }>(
    executor,
    'SELECT id, name, nip FROM users WHERE id = ? LIMIT 1',
    [userId],
  );
  return result[0] ?? null;
};

/** Identitas instansi (kop surat) tersimpan sebagai settings `instance.*`. */
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
