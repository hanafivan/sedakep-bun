import type { Pool, PoolConnection } from 'mysql2/promise';
import { getMySql } from '../../../db/mysql';

/**
 * COMMAND = operasi tulis modul surat tugas. Semua INSERT/UPDATE/DELETE ada di
 * sini. Tidak ada logika bisnis di file ini.
 */

export type Executor = Pool | PoolConnection;

export type NewAssignmentLetter = {
  user_id: number;
  legacy_id?: string | null;
  code?: string | null;
  letter_number?: string | null;
  consideration?: string | null;
  legal_basis?: string | null;
  content?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  day_start?: string | null;
  day_end?: string | null;
  place?: string | null;
  time_start?: string | null;
  time_end?: string | null;
  signer_name?: string | null;
  signer_position?: string | null;
  footnote?: string | null;
  status?: string;
  decision?: string;
  anomaly_flag?: string | null;
};

export const insertAssignmentLetter = async (
  data: NewAssignmentLetter,
  executor: Executor = getMySql(),
): Promise<number> => {
  const [result] = await executor.execute<import('mysql2/promise').ResultSetHeader>(
    `INSERT INTO assignment_letters (
       user_id, legacy_id, code, letter_number, consideration, legal_basis, content,
       start_date, end_date, day_start, day_end, place, time_start, time_end,
       signer_name, signer_position, footnote, status, decision, anomaly_flag
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      data.user_id, data.legacy_id ?? null, data.code ?? null, data.letter_number ?? null,
      data.consideration ?? null, data.legal_basis ?? null, data.content ?? null,
      data.start_date ?? null, data.end_date ?? null, data.day_start ?? null, data.day_end ?? null,
      data.place ?? null, data.time_start ?? null, data.time_end ?? null,
      data.signer_name ?? null, data.signer_position ?? null, data.footnote ?? null,
      data.status ?? 'submitted', data.decision ?? 'pending', data.anomaly_flag ?? null,
    ],
  );
  return result.insertId;
};

const LETTER_COLUMNS: Record<string, string> = {
  code: 'code',
  consideration: 'consideration',
  legal_basis: 'legal_basis',
  content: 'content',
  start_date: 'start_date',
  end_date: 'end_date',
  day_start: 'day_start',
  day_end: 'day_end',
  place: 'place',
  time_start: 'time_start',
  time_end: 'time_end',
  signer_name: 'signer_name',
  signer_position: 'signer_position',
  footnote: 'footnote',
  anomaly_flag: 'anomaly_flag',
};

export const updateAssignmentLetter = async (
  id: number,
  data: Record<string, unknown>,
  executor: Executor = getMySql(),
): Promise<void> => {
  const columns: string[] = [];
  const values: unknown[] = [];
  for (const [key, column] of Object.entries(LETTER_COLUMNS)) {
    if (data[key] !== undefined) {
      columns.push(`${column} = ?`);
      values.push(data[key]);
    }
  }
  if (columns.length === 0) return;
  await executor.query(
    `UPDATE assignment_letters SET ${columns.join(', ')} WHERE id = ?`,
    [...values, id],
  );
};

export const updateAssignmentDecision = async (
  id: number,
  data: {
    decision: string;
    status: string;
    decided_by?: number | null;
    decided_at?: string | null;
    decision_note?: string | null;
  },
  executor: Executor = getMySql(),
): Promise<void> => {
  await executor.execute(
    `UPDATE assignment_letters
        SET decision = ?, status = ?, decided_by = ?, decided_at = ?, decision_note = ?
      WHERE id = ?`,
    [
      data.decision,
      data.status,
      data.decided_by ?? null,
      data.decided_at ?? null,
      data.decision_note ?? null,
      id,
    ],
  );
};

export const setAssignmentNumber = async (
  id: number,
  letterNumber: string,
  printedAt: string | null,
  executor: Executor = getMySql(),
): Promise<void> => {
  await executor.execute(
    'UPDATE assignment_letters SET letter_number = ?, printed_at = COALESCE(printed_at, ?) WHERE id = ?',
    [letterNumber, printedAt, id],
  );
};

export const markAssignmentPrinted = async (
  id: number,
  printedAt: string,
  executor: Executor = getMySql(),
): Promise<void> => {
  await executor.execute('UPDATE assignment_letters SET printed_at = ? WHERE id = ?', [
    printedAt,
    id,
  ]);
};

export const deleteAssignmentLetter = async (
  id: number,
  executor: Executor = getMySql(),
): Promise<void> => {
  await executor.execute('DELETE FROM assignment_letters WHERE id = ?', [id]);
};

export const markAssignmentCancelled = async (
  id: number,
  executor: Executor = getMySql(),
): Promise<void> => {
  await executor.execute(
    "UPDATE assignment_letters SET status = 'cancelled', decision = 'pending' WHERE id = ?",
    [id],
  );
};

// ---------------------------------------------------------------------------
// Anggota (members)
// ---------------------------------------------------------------------------

export const insertAssignmentMember = async (
  data: {
    letter_id: number;
    name: string;
    nip?: string | null;
    grade?: string | null;
    position?: string | null;
    organization_name?: string | null;
    sort_order?: number | null;
  },
  executor: Executor = getMySql(),
): Promise<number> => {
  const [result] = await executor.execute<import('mysql2/promise').ResultSetHeader>(
    `INSERT INTO assignment_members
       (letter_id, name, nip, grade, position, organization_name, sort_order)
     VALUES (?,?,?,?,?,?,?)`,
    [
      data.letter_id,
      data.name,
      data.nip ?? null,
      data.grade ?? null,
      data.position ?? null,
      data.organization_name ?? null,
      data.sort_order ?? 0,
    ],
  );
  return result.insertId;
};

export const updateAssignmentMember = async (
  id: number,
  data: Record<string, unknown>,
  executor: Executor = getMySql(),
): Promise<void> => {
  const allowed = ['name', 'nip', 'grade', 'position', 'organization_name', 'sort_order'];
  const columns: string[] = [];
  const values: unknown[] = [];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      columns.push(`${key} = ?`);
      values.push(data[key]);
    }
  }
  if (columns.length === 0) return;
  await executor.query(`UPDATE assignment_members SET ${columns.join(', ')} WHERE id = ?`, [
    ...values,
    id,
  ]);
};

export const deleteAssignmentMember = async (
  id: number,
  executor: Executor = getMySql(),
): Promise<void> => {
  await executor.execute('DELETE FROM assignment_members WHERE id = ?', [id]);
};

// ---------------------------------------------------------------------------
// Keterangan (notes)
// ---------------------------------------------------------------------------

export const insertAssignmentNote = async (
  data: { letter_id: number; note: string; sort_order?: number | null },
  executor: Executor = getMySql(),
): Promise<number> => {
  const [result] = await executor.execute<import('mysql2/promise').ResultSetHeader>(
    'INSERT INTO assignment_notes (letter_id, note, sort_order) VALUES (?,?,?)',
    [data.letter_id, data.note, data.sort_order ?? 0],
  );
  return result.insertId;
};

export const updateAssignmentNote = async (
  id: number,
  data: { note?: string; sort_order?: number },
  executor: Executor = getMySql(),
): Promise<void> => {
  const columns: string[] = [];
  const values: unknown[] = [];
  if (data.note !== undefined) {
    columns.push('note = ?');
    values.push(data.note);
  }
  if (data.sort_order !== undefined) {
    columns.push('sort_order = ?');
    values.push(data.sort_order);
  }
  if (columns.length === 0) return;
  await executor.query(`UPDATE assignment_notes SET ${columns.join(', ')} WHERE id = ?`, [
    ...values,
    id,
  ]);
};

export const deleteAssignmentNote = async (
  id: number,
  executor: Executor = getMySql(),
): Promise<void> => {
  await executor.execute('DELETE FROM assignment_notes WHERE id = ?', [id]);
};

// ---------------------------------------------------------------------------
// Tembusan (copies)
// ---------------------------------------------------------------------------

export const insertAssignmentCopy = async (
  data: { letter_id: number; copy_to: string; sort_order?: number | null },
  executor: Executor = getMySql(),
): Promise<number> => {
  const [result] = await executor.execute<import('mysql2/promise').ResultSetHeader>(
    'INSERT INTO assignment_copies (letter_id, copy_to, sort_order) VALUES (?,?,?)',
    [data.letter_id, data.copy_to, data.sort_order ?? 0],
  );
  return result.insertId;
};

export const updateAssignmentCopy = async (
  id: number,
  data: { copy_to?: string; sort_order?: number },
  executor: Executor = getMySql(),
): Promise<void> => {
  const columns: string[] = [];
  const values: unknown[] = [];
  if (data.copy_to !== undefined) {
    columns.push('copy_to = ?');
    values.push(data.copy_to);
  }
  if (data.sort_order !== undefined) {
    columns.push('sort_order = ?');
    values.push(data.sort_order);
  }
  if (columns.length === 0) return;
  await executor.query(`UPDATE assignment_copies SET ${columns.join(', ')} WHERE id = ?`, [
    ...values,
    id,
  ]);
};

export const deleteAssignmentCopy = async (
  id: number,
  executor: Executor = getMySql(),
): Promise<void> => {
  await executor.execute('DELETE FROM assignment_copies WHERE id = ?', [id]);
};

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export const insertAuditLog = async (
  data: {
    actor_id?: number | null;
    action: string;
    entity_table: string;
    entity_id?: number | null;
    before_data?: unknown;
    after_data?: unknown;
  },
  executor: Executor = getMySql(),
): Promise<void> => {
  await executor.execute(
    `INSERT INTO audit_logs (actor_id, action, entity_table, entity_id, before_data, after_data)
     VALUES (?,?,?,?,?,?)`,
    [
      data.actor_id ?? null,
      data.action,
      data.entity_table,
      data.entity_id ?? null,
      data.before_data === undefined ? null : JSON.stringify(data.before_data),
      data.after_data === undefined ? null : JSON.stringify(data.after_data),
    ],
  );
};
