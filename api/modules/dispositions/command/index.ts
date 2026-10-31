import type { Pool, PoolConnection } from 'mysql2/promise';
import { getMySql } from '../../../db/mysql';

/**
 * COMMAND = operasi tulis modul disposisi. Semua INSERT/UPDATE/DELETE ada di
 * sini. Tidak ada logika bisnis di file ini.
 */

export type Executor = Pool | PoolConnection;

export type NewIncomingLetter = {
  created_by?: number | null;
  legacy_id?: string | null;
  owner_name?: string | null;
  owner_nip?: string | null;
  agenda_number?: string | null;
  ticket_number?: string | null;
  letter_number?: string | null;
  origin?: string | null;
  content?: string | null;
  classification_code?: string | null;
  index_code?: string | null;
  letter_date?: string | null;
  received_date?: string | null;
  notes?: string | null;
};

export const insertIncomingLetter = async (
  data: NewIncomingLetter,
  executor: Executor = getMySql(),
): Promise<number> => {
  const [result] = await executor.execute<import('mysql2/promise').ResultSetHeader>(
    `INSERT INTO incoming_letters (
       created_by, legacy_id, owner_name, owner_nip, agenda_number, ticket_number,
       letter_number, origin, content, classification_code, index_code,
       letter_date, received_date, notes, status
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'baru')`,
    [
      data.created_by ?? null, data.legacy_id ?? null, data.owner_name ?? null,
      data.owner_nip ?? null, data.agenda_number ?? null, data.ticket_number ?? null,
      data.letter_number ?? null, data.origin ?? null, data.content ?? null,
      data.classification_code ?? null, data.index_code ?? null,
      data.letter_date ?? null, data.received_date ?? null, data.notes ?? null,
    ],
  );
  return result.insertId;
};

const LETTER_COLUMNS = [
  'owner_name',
  'owner_nip',
  'agenda_number',
  'ticket_number',
  'letter_number',
  'origin',
  'content',
  'classification_code',
  'index_code',
  'letter_date',
  'received_date',
  'notes',
  'status',
  'anomaly_flag',
];

export const updateIncomingLetter = async (
  id: number,
  data: Record<string, unknown>,
  executor: Executor = getMySql(),
): Promise<void> => {
  const columns: string[] = [];
  const values: unknown[] = [];
  for (const key of LETTER_COLUMNS) {
    if (data[key] !== undefined) {
      columns.push(`${key} = ?`);
      values.push(data[key]);
    }
  }
  if (columns.length === 0) return;
  await executor.query(
    `UPDATE incoming_letters SET ${columns.join(', ')} WHERE id = ?`,
    [...values, id],
  );
};

export const finalizeIncomingLetter = async (
  id: number,
  executor: Executor = getMySql(),
): Promise<void> => {
  await executor.execute(
    "UPDATE incoming_letters SET status = 'selesai', finalized_at = NOW() WHERE id = ?",
    [id],
  );
};

export const deleteIncomingLetter = async (
  id: number,
  executor: Executor = getMySql(),
): Promise<void> => {
  await executor.execute('DELETE FROM incoming_letters WHERE id = ?', [id]);
};

// ---------------------------------------------------------------------------
// Disposisi (pelaksana)
// ---------------------------------------------------------------------------

export const insertDisposition = async (
  data: {
    incoming_letter_id: number;
    target_name?: string | null;
    target_nip?: string | null;
    instruction?: string | null;
    notes?: string | null;
    sort_order?: number | null;
  },
  executor: Executor = getMySql(),
): Promise<number> => {
  const [result] = await executor.execute<import('mysql2/promise').ResultSetHeader>(
    `INSERT INTO dispositions (incoming_letter_id, target_name, target_nip, instruction, notes, sort_order)
     VALUES (?,?,?,?,?,?)`,
    [
      data.incoming_letter_id,
      data.target_name ?? null,
      data.target_nip ?? null,
      data.instruction ?? null,
      data.notes ?? null,
      data.sort_order ?? 0,
    ],
  );
  return result.insertId;
};

export const updateDisposition = async (
  id: number,
  data: Record<string, unknown>,
  executor: Executor = getMySql(),
): Promise<void> => {
  const allowed = ['target_name', 'target_nip', 'instruction', 'notes', 'sort_order', 'status', 'decided_at'];
  const columns: string[] = [];
  const values: unknown[] = [];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      columns.push(`${key} = ?`);
      values.push(data[key]);
    }
  }
  if (columns.length === 0) return;
  await executor.query(`UPDATE dispositions SET ${columns.join(', ')} WHERE id = ?`, [
    ...values,
    id,
  ]);
};

export const deleteDisposition = async (
  id: number,
  executor: Executor = getMySql(),
): Promise<void> => {
  await executor.execute('DELETE FROM dispositions WHERE id = ?', [id]);
};

// ---------------------------------------------------------------------------
// Final & referensi
// ---------------------------------------------------------------------------

export const insertDispositionFinal = async (
  data: {
    incoming_letter_id: number;
    name?: string | null;
    nip?: string | null;
    instruction?: string | null;
  },
  executor: Executor = getMySql(),
): Promise<number> => {
  const [result] = await executor.execute<import('mysql2/promise').ResultSetHeader>(
    `INSERT INTO disposition_finals (incoming_letter_id, name, nip, instruction) VALUES (?,?,?,?)`,
    [data.incoming_letter_id, data.name ?? null, data.nip ?? null, data.instruction ?? null],
  );
  return result.insertId;
};

export const deleteDispositionFinal = async (
  id: number,
  executor: Executor = getMySql(),
): Promise<void> => {
  await executor.execute('DELETE FROM disposition_finals WHERE id = ?', [id]);
};

export const insertReference = async (
  data: { incoming_letter_id: number; reference_text: string },
  executor: Executor = getMySql(),
): Promise<number> => {
  const [result] = await executor.execute<import('mysql2/promise').ResultSetHeader>(
    'INSERT INTO incoming_letter_references (incoming_letter_id, reference_text) VALUES (?,?)',
    [data.incoming_letter_id, data.reference_text],
  );
  return result.insertId;
};

export const deleteReference = async (
  id: number,
  executor: Executor = getMySql(),
): Promise<void> => {
  await executor.execute('DELETE FROM incoming_letter_references WHERE id = ?', [id]);
};

// ---------------------------------------------------------------------------
// Klasifikasi
// ---------------------------------------------------------------------------

export const insertClassification = async (
  data: { code: string; name: string; description?: string | null; is_active?: number },
  executor: Executor = getMySql(),
): Promise<number> => {
  const [result] = await executor.execute<import('mysql2/promise').ResultSetHeader>(
    'INSERT INTO letter_classifications (code, name, description, is_active) VALUES (?,?,?,?)',
    [data.code, data.name, data.description ?? null, data.is_active ?? 1],
  );
  return result.insertId;
};

export const updateClassification = async (
  id: number,
  data: { code?: string; name?: string; description?: string | null; is_active?: number },
  executor: Executor = getMySql(),
): Promise<void> => {
  const columns: string[] = [];
  const values: unknown[] = [];
  for (const key of ['code', 'name', 'description', 'is_active'] as const) {
    if (data[key] !== undefined) {
      columns.push(`${key} = ?`);
      values.push(data[key]);
    }
  }
  if (columns.length === 0) return;
  await executor.query(`UPDATE letter_classifications SET ${columns.join(', ')} WHERE id = ?`, [
    ...values,
    id,
  ]);
};

export const deleteClassification = async (
  id: number,
  executor: Executor = getMySql(),
): Promise<void> => {
  await executor.execute('DELETE FROM letter_classifications WHERE id = ?', [id]);
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
