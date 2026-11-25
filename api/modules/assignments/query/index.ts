import { getMySql } from '../../../db/mysql';
import type { Executor } from '../../../shared/db';
import { rows } from '../../../shared/db';
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

export { findInstanceProfile, findUserIdentityById } from '../../../shared/db';

export type AssignmentLetterListRow = AssignmentLetterRow & { name: string; nip: string | null };

export const findAssignmentLetters = async (
  filter: {
    userId?: number;
    userNip?: string;
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

  if (filter.userId && filter.userNip) {
    where.push('(l.user_id = ? OR EXISTS (SELECT 1 FROM assignment_members m WHERE m.letter_id = l.id AND m.nip = ?))');
    params.push(filter.userId, filter.userNip);
  } else if (filter.userId) {
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
  filter: { userId?: number; userNip?: string; status?: string; year?: number; search?: string },
  executor: Executor = getMySql(),
): Promise<number> => {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filter.userId && filter.userNip) {
    where.push('(l.user_id = ? OR EXISTS (SELECT 1 FROM assignment_members m WHERE m.letter_id = l.id AND m.nip = ?))');
    params.push(filter.userId, filter.userNip);
  } else if (filter.userId) {
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

/** Identitas user & instansi (kop surat) — re-exported dari shared/db. */

export type AvailableEmployeeRow = {
  id: number;
  name: string;
  nip: string | null;
  grade: string | null;
  position: string;
  organization_name: string;
};

export const searchAvailableEmployees = async (
  search?: string,
  limit = 20,
  executor: Executor = getMySql(),
): Promise<AvailableEmployeeRow[]> => {
  const where: string[] = ['u.is_active = 1'];
  const params: unknown[] = [];
  if (search && search.trim()) {
    where.push('(u.name LIKE ? OR u.nip LIKE ?)');
    const like = `%${search.trim()}%`;
    params.push(like, like);
  }
  params.push(Math.min(Math.max(limit, 1), 50));
  return rows<AvailableEmployeeRow>(
    executor,
    `SELECT 
       u.id, 
       u.name, 
       u.nip, 
       u.grade, 
       COALESCE(p.name, '') AS position, 
       COALESCE(o.name, u.unit_name, '') AS organization_name
     FROM users u
     LEFT JOIN positions p ON p.id = u.position_id
     LEFT JOIN organizations o ON o.id = u.organization_id
     WHERE ${where.join(' AND ')}
     ORDER BY u.name ASC
     LIMIT ?`,
    params,
  );
};

