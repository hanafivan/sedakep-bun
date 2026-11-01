import { getMySql } from '../../../db/mysql';
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';

export type Executor = Pool | PoolConnection;

export type LeaveLetterRow = {
  id: number;
  leave_request_id: number;
  letter_type: 'suket' | 'suket_madrasah';
  number: string | null;
  issued_at: string | null;
  official_position: string | null;
  official_name: string | null;
  document_id: number | null;
  legacy_id?: string | null;
  created_by?: number | null;
};

export type LeaveRequestSummaryRow = {
  id: number;
  status: string;
  leave_type: string;
  start_date: string | Date;
};

const rows = async <T>(executor: Executor, sql: string, params: unknown[] = []): Promise<T[]> => {
  const [result] = await executor.query<RowDataPacket[]>(sql, params);
  return result as unknown as T[];
};

export const findLeaveLetters = async (
  filter: { letterType?: string; search?: string; limit?: number; offset?: number } = {},
  executor: Executor = getMySql(),
): Promise<Array<LeaveLetterRow & { name: string; nip: string | null; leave_type: string }>> => {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.letterType) {
    where.push('l.letter_type = ?');
    params.push(filter.letterType);
  }
  if (filter.search) {
    where.push('(l.number LIKE ? OR r.name LIKE ? OR r.nip LIKE ?)');
    const like = `%${filter.search}%`;
    params.push(like, like, like);
  }
  params.push(Math.min(Math.max(filter.limit ?? 25, 1), 200), Math.max(filter.offset ?? 0, 0));
  return rows(
    executor,
    `SELECT l.*, r.name, r.nip, r.leave_type
       FROM leave_letters l
       JOIN leave_requests r ON r.id = l.leave_request_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY l.issued_at DESC, l.id DESC
      LIMIT ? OFFSET ?`,
    params,
  );
};

export const findLeaveLetterByRequest = async (
  leaveRequestId: number,
  executor: Executor = getMySql(),
): Promise<LeaveLetterRow[]> =>
  rows<LeaveLetterRow>(
    executor,
    'SELECT * FROM leave_letters WHERE leave_request_id = ? ORDER BY letter_type',
    [leaveRequestId],
  );

export const findLeaveLetterById = async (
  id: number,
  executor: Executor = getMySql(),
): Promise<LeaveLetterRow | null> => {
  const result = await rows<LeaveLetterRow>(
    executor,
    'SELECT * FROM leave_letters WHERE id = ? LIMIT 1',
    [id],
  );
  return result[0] ?? null;
};

export const findLeaveRequestById = async (
  id: number,
  executor: Executor = getMySql(),
): Promise<LeaveRequestSummaryRow | null> => {
  const result = await rows<LeaveRequestSummaryRow>(
    executor,
    'SELECT id, status, leave_type, start_date FROM leave_requests WHERE id = ? LIMIT 1',
    [id],
  );
  return result[0] ?? null;
};
