import { getMySql } from '../../../db/mysql';
import type { Pool, PoolConnection } from 'mysql2/promise';

export type Executor = Pool | PoolConnection;

export const upsertLeaveLetter = async (
  data: {
    leave_request_id: number;
    letter_type: 'suket' | 'suket_madrasah';
    number?: string | null;
    issued_at?: string | null;
    official_position?: string | null;
    official_name?: string | null;
    document_id?: number | null;
    legacy_id?: string | null;
    created_by?: number | null;
  },
  executor: Executor = getMySql(),
): Promise<number> => {
  const [result] = await executor.execute<import('mysql2/promise').ResultSetHeader>(
    `INSERT INTO leave_letters
       (leave_request_id, letter_type, number, issued_at, official_position, official_name,
        document_id, legacy_id, created_by)
     VALUES (?,?,?,?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE
       number = VALUES(number),
       issued_at = VALUES(issued_at),
       official_position = VALUES(official_position),
       official_name = VALUES(official_name),
       document_id = VALUES(document_id)`,
    [
      data.leave_request_id, data.letter_type, data.number ?? null, data.issued_at ?? null,
      data.official_position ?? null, data.official_name ?? null,
      data.document_id ?? null, data.legacy_id ?? null, data.created_by ?? null,
    ],
  );
  return Number(result.insertId || 0);
};

export const deleteLeaveLetter = async (
  leaveRequestId: number,
  letterType: 'suket' | 'suket_madrasah',
  executor: Executor = getMySql(),
): Promise<void> => {
  await executor.execute(
    'DELETE FROM leave_letters WHERE leave_request_id = ? AND letter_type = ?',
    [leaveRequestId, letterType],
  );
};

export const nextLeaveLetterNumber = async (
  letterType: 'suket' | 'suket_madrasah',
  year: number,
  executor: Executor = getMySql(),
): Promise<number> => {
  const [result] = await executor.query<import('mysql2/promise').ResultSetHeader>(
    `INSERT INTO leave_letter_counters (letter_type, year, last_number)
     VALUES (?, ?, LAST_INSERT_ID(1))
     ON DUPLICATE KEY UPDATE last_number = LAST_INSERT_ID(last_number + 1)`,
    [letterType, year],
  );
  return Number(result.insertId ?? 1);
};

export const insertAuditLog = async (
  data: {
    actor_id?: number | null;
    action: string;
    entity_table: string;
    entity_id?: number | null;
    before_data?: unknown;
    after_data?: unknown;
    ip_address?: string | null;
  },
  executor: Executor = getMySql(),
): Promise<void> => {
  await executor.execute(
    `INSERT INTO audit_logs (actor_id, action, entity_table, entity_id, before_data, after_data, ip_address)
     VALUES (?,?,?,?,?,?,?)`,
    [
      data.actor_id ?? null, data.action, data.entity_table, data.entity_id ?? null,
      data.before_data === undefined ? null : JSON.stringify(data.before_data),
      data.after_data === undefined ? null : JSON.stringify(data.after_data),
      data.ip_address ?? null,
    ],
  );
};
