import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { getMySql } from '../../../db/mysql';
import type {
  DispositionFinalRow,
  DispositionRow,
  IncomingLetterRefRow,
  IncomingLetterRow,
  LetterClassificationRow,
} from '../schema/types';

/**
 * QUERY = operasi baca modul disposisi. Semua SELECT ada di sini.
 * Tidak ada logika bisnis di file ini.
 */

type Executor = Pool | PoolConnection;

const rows = async <T>(executor: Executor, sql: string, params: unknown[] = []): Promise<T[]> => {
  const [result] = await executor.query<RowDataPacket[]>(sql, params);
  return result as unknown as T[];
};

export type IncomingLetterListRow = IncomingLetterRow & { disposition_count: number };

export const findIncomingLetters = async (
  filter: { status?: string; year?: number; search?: string; limit?: number; offset?: number },
  executor: Executor = getMySql(),
): Promise<IncomingLetterListRow[]> => {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filter.status) {
    where.push('status = ?');
    params.push(filter.status);
  }
  if (filter.year) {
    where.push('YEAR(received_date) = ?');
    params.push(filter.year);
  }
  if (filter.search) {
    where.push(
      '(letter_number LIKE ? OR origin LIKE ? OR agenda_number LIKE ? OR owner_name LIKE ? OR CAST(id AS CHAR) = ?)',
    );
    const like = `%${filter.search}%`;
    params.push(like, like, like, like, filter.search);
  }

  const limit = Math.min(Math.max(filter.limit ?? 25, 1), 200);
  const offset = Math.max(filter.offset ?? 0, 0);
  params.push(limit, offset);

  return rows<IncomingLetterListRow>(
    executor,
    `SELECT l.*, (SELECT COUNT(*) FROM dispositions d WHERE d.incoming_letter_id = l.id) AS disposition_count
       FROM incoming_letters l
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY l.received_date DESC, l.id DESC
      LIMIT ? OFFSET ?`,
    params,
  );
};

export const countIncomingLetters = async (
  filter: { status?: string; year?: number; search?: string },
  executor: Executor = getMySql(),
): Promise<number> => {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.status) {
    where.push('status = ?');
    params.push(filter.status);
  }
  if (filter.year) {
    where.push('YEAR(received_date) = ?');
    params.push(filter.year);
  }
  if (filter.search) {
    where.push(
      '(letter_number LIKE ? OR origin LIKE ? OR agenda_number LIKE ? OR owner_name LIKE ? OR CAST(id AS CHAR) = ?)',
    );
    const like = `%${filter.search}%`;
    params.push(like, like, like, like, filter.search);
  }
  const result = await rows<{ total: number }>(
    executor,
    `SELECT COUNT(*) AS total FROM incoming_letters ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`,
    params,
  );
  return Number(result[0]?.total ?? 0);
};

export const findIncomingLetterById = async (
  id: number,
  executor: Executor = getMySql(),
): Promise<IncomingLetterRow | null> => {
  const result = await rows<IncomingLetterRow>(
    executor,
    'SELECT * FROM incoming_letters WHERE id = ? LIMIT 1',
    [id],
  );
  return result[0] ?? null;
};

export const findDispositions = async (
  letterId: number,
  executor: Executor = getMySql(),
): Promise<DispositionRow[]> =>
  rows<DispositionRow>(
    executor,
    'SELECT * FROM dispositions WHERE incoming_letter_id = ? ORDER BY sort_order ASC, id ASC',
    [letterId],
  );

export const findDispositionById = async (
  id: number,
  executor: Executor = getMySql(),
): Promise<DispositionRow | null> => {
  const result = await rows<DispositionRow>(
    executor,
    'SELECT * FROM dispositions WHERE id = ? LIMIT 1',
    [id],
  );
  return result[0] ?? null;
};

export const findDispositionFinals = async (
  letterId: number,
  executor: Executor = getMySql(),
): Promise<DispositionFinalRow[]> =>
  rows<DispositionFinalRow>(
    executor,
    'SELECT * FROM disposition_finals WHERE incoming_letter_id = ? ORDER BY id ASC',
    [letterId],
  );

export const findDispositionFinalById = async (
  id: number,
  executor: Executor = getMySql(),
): Promise<DispositionFinalRow | null> => {
  const result = await rows<DispositionFinalRow>(
    executor,
    'SELECT * FROM disposition_finals WHERE id = ? LIMIT 1',
    [id],
  );
  return result[0] ?? null;
};

export const findReferences = async (
  letterId: number,
  executor: Executor = getMySql(),
): Promise<IncomingLetterRefRow[]> =>
  rows<IncomingLetterRefRow>(
    executor,
    'SELECT * FROM incoming_letter_references WHERE incoming_letter_id = ? ORDER BY id ASC',
    [letterId],
  );

export const findReferenceById = async (
  id: number,
  executor: Executor = getMySql(),
): Promise<IncomingLetterRefRow | null> => {
  const result = await rows<IncomingLetterRefRow>(
    executor,
    'SELECT * FROM incoming_letter_references WHERE id = ? LIMIT 1',
    [id],
  );
  return result[0] ?? null;
};

export const findClassifications = async (
  filter: { search?: string; activeOnly?: boolean } = {},
  executor: Executor = getMySql(),
): Promise<LetterClassificationRow[]> => {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.activeOnly) where.push('is_active = 1');
  if (filter.search) {
    where.push('(code LIKE ? OR name LIKE ?)');
    const like = `%${filter.search}%`;
    params.push(like, like);
  }
  return rows<LetterClassificationRow>(
    executor,
    `SELECT * FROM letter_classifications
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY code ASC`,
    params,
  );
};

export const findClassificationById = async (
  id: number,
  executor: Executor = getMySql(),
): Promise<LetterClassificationRow | null> => {
  const result = await rows<LetterClassificationRow>(
    executor,
    'SELECT * FROM letter_classifications WHERE id = ? LIMIT 1',
    [id],
  );
  return result[0] ?? null;
};

export const findClassificationByCode = async (
  code: string,
  executor: Executor = getMySql(),
): Promise<LetterClassificationRow | null> => {
  const result = await rows<LetterClassificationRow>(
    executor,
    'SELECT * FROM letter_classifications WHERE code = ? LIMIT 1',
    [code],
  );
  return result[0] ?? null;
};

/** Identitas instansi (kop cetak disposisi) tersimpan sebagai settings `instance.*`. */
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
