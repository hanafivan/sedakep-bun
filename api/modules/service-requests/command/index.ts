import type { Pool, PoolConnection } from 'mysql2/promise';
import { getMySql } from '../../../db/mysql';

/**
 * COMMAND = operasi tulis modul layanan kepegawaian. Tidak ada logika bisnis
 * di file ini.
 */

export type Executor = Pool | PoolConnection;

export type NewServiceRequest = {
  legacy_table: string;
  legacy_id?: string | null;
  service_type: string;
  user_id: number;
  name: string;
  nip?: string | null;
  grade?: string | null;
  position?: string | null;
  organization_name?: string | null;
  phone?: string | null;
  title?: string | null;
  campus?: string | null;
  faculty?: string | null;
  major?: string | null;
  subtype?: string | null;
  approver_1_name?: string | null;
  approver_1_nip?: string | null;
  approver_1_position?: string | null;
};

export const insertServiceRequest = async (
  data: NewServiceRequest,
  executor: Executor = getMySql(),
): Promise<number> => {
  const [result] = await executor.execute<import('mysql2/promise').ResultSetHeader>(
    `INSERT INTO service_requests (
       legacy_table, legacy_id, service_type, user_id, name, nip, grade, position,
       organization_name, phone, title, campus, faculty, major, subtype,
       approver_1_name, approver_1_nip, approver_1_position
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      data.legacy_table, data.legacy_id ?? null, data.service_type, data.user_id,
      data.name, data.nip ?? null, data.grade ?? null, data.position ?? null,
      data.organization_name ?? null, data.phone ?? null, data.title ?? null,
      data.campus ?? null, data.faculty ?? null, data.major ?? null, data.subtype ?? null,
      data.approver_1_name ?? null, data.approver_1_nip ?? null, data.approver_1_position ?? null,
    ],
  );
  return result.insertId;
};

const REQUEST_COLUMNS = [
  'name',
  'nip',
  'grade',
  'position',
  'organization_name',
  'phone',
  'title',
  'campus',
  'faculty',
  'major',
  'subtype',
  'approver_1_name',
  'approver_1_nip',
  'approver_1_position',
];

export const updateServiceRequest = async (
  id: number,
  data: Record<string, unknown>,
  executor: Executor = getMySql(),
): Promise<void> => {
  const columns: string[] = [];
  const values: unknown[] = [];
  for (const key of REQUEST_COLUMNS) {
    if (data[key] !== undefined) {
      columns.push(`${key} = ?`);
      values.push(data[key]);
    }
  }
  if (columns.length === 0) return;
  await executor.query(
    `UPDATE service_requests SET ${columns.join(', ')} WHERE id = ?`,
    [...values, id],
  );
};

export const updateServiceDecision = async (
  id: number,
  data: {
    decision: string;
    status: string;
    approver_1_status?: string;
    decided_by?: number | null;
    decided_at?: string | null;
    decision_note?: string | null;
  },
  executor: Executor = getMySql(),
): Promise<void> => {
  await executor.execute(
    `UPDATE service_requests
        SET decision = ?, status = ?, approver_1_status = COALESCE(?, approver_1_status),
            decided_by = ?, decided_at = ?, decision_note = ?
      WHERE id = ?`,
    [
      data.decision,
      data.status,
      data.approver_1_status ?? null,
      data.decided_by ?? null,
      data.decided_at ?? null,
      data.decision_note ?? null,
      id,
    ],
  );
};

export const deleteServiceRequest = async (
  id: number,
  executor: Executor = getMySql(),
): Promise<void> => {
  await executor.execute('DELETE FROM service_requests WHERE id = ?', [id]);
};

export const upsertServiceField = async (
  requestId: number,
  key: string,
  value: string | null,
  executor: Executor = getMySql(),
): Promise<void> => {
  await executor.execute(
    `INSERT INTO service_request_fields (request_id, field_key, field_value) VALUES (?,?,?)
     ON DUPLICATE KEY UPDATE field_value = VALUES(field_value)`,
    [requestId, key, value],
  );
};

export const upsertServiceDocument = async (
  requestId: number,
  label: string,
  documentId: number | null,
  executor: Executor = getMySql(),
): Promise<void> => {
  await executor.execute(
    `INSERT INTO service_documents (request_id, label, document_id) VALUES (?,?,?)
     ON DUPLICATE KEY UPDATE document_id = VALUES(document_id), updated_at = NOW()`,
    [requestId, label, documentId],
  );
};

export const insertServiceCheck = async (
  data: {
    request_id: number;
    check_type: string;
    result?: string | null;
    notes?: string | null;
    checked_by?: number | null;
  },
  executor: Executor = getMySql(),
): Promise<number> => {
  const [result] = await executor.execute<import('mysql2/promise').ResultSetHeader>(
    `INSERT INTO service_request_checks (request_id, check_type, result, notes, checked_by, checked_at)
     VALUES (?,?,?,?,?,NOW())`,
    [
      data.request_id,
      data.check_type,
      data.result ?? null,
      data.notes ?? null,
      data.checked_by ?? null,
    ],
  );
  return result.insertId;
};

export const insertGeneratedLetter = async (
  data: {
    letter_type: string;
    entity_table: string;
    entity_id: number;
    number?: string | null;
    document_id?: number | null;
    issued_at?: string | null;
  },
  executor: Executor = getMySql(),
): Promise<number> => {
  const [result] = await executor.execute<import('mysql2/promise').ResultSetHeader>(
    `INSERT INTO generated_letters (letter_type, entity_table, entity_id, number, document_id, issued_at)
     VALUES (?,?,?,?,?,?)`,
    [
      data.letter_type,
      data.entity_table,
      data.entity_id,
      data.number ?? null,
      data.document_id ?? null,
      data.issued_at ?? null,
    ],
  );
  return result.insertId;
};

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
