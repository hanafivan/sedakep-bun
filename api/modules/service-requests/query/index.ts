import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { getMySql } from '../../../db/mysql';
import type {
  GeneratedLetterRow,
  ServiceCheckRow,
  ServiceDocumentRow,
  ServiceFieldRow,
  ServiceRequestRow,
} from '../schema/types';

/**
 * QUERY = operasi baca modul layanan kepegawaian. Semua SELECT ada di sini.
 * Tidak ada logika bisnis di file ini.
 */

type Executor = Pool | PoolConnection;

const rows = async <T>(executor: Executor, sql: string, params: unknown[] = []): Promise<T[]> => {
  const [result] = await executor.query<RowDataPacket[]>(sql, params);
  return result as unknown as T[];
};

export const findServiceRequests = async (
  filter: {
    serviceType?: string;
    status?: string;
    userId?: number;
    search?: string;
    limit?: number;
    offset?: number;
  },
  executor: Executor = getMySql(),
): Promise<ServiceRequestRow[]> => {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.serviceType) {
    where.push('service_type = ?');
    params.push(filter.serviceType);
  }
  if (filter.status) {
    where.push('status = ?');
    params.push(filter.status);
  }
  if (filter.userId) {
    where.push('user_id = ?');
    params.push(filter.userId);
  }
  if (filter.search) {
    where.push('(name LIKE ? OR nip LIKE ? OR title LIKE ? OR CAST(id AS CHAR) = ?)');
    const like = `%${filter.search}%`;
    params.push(like, like, like, filter.search);
  }
  params.push(Math.min(Math.max(filter.limit ?? 25, 1), 200), Math.max(filter.offset ?? 0, 0));
  return rows<ServiceRequestRow>(
    executor,
    `SELECT * FROM service_requests
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY created_at DESC, id DESC
      LIMIT ? OFFSET ?`,
    params,
  );
};

export const countServiceRequests = async (
  filter: { serviceType?: string; status?: string; userId?: number; search?: string },
  executor: Executor = getMySql(),
): Promise<number> => {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.serviceType) {
    where.push('service_type = ?');
    params.push(filter.serviceType);
  }
  if (filter.status) {
    where.push('status = ?');
    params.push(filter.status);
  }
  if (filter.userId) {
    where.push('user_id = ?');
    params.push(filter.userId);
  }
  if (filter.search) {
    where.push('(name LIKE ? OR nip LIKE ? OR title LIKE ? OR CAST(id AS CHAR) = ?)');
    const like = `%${filter.search}%`;
    params.push(like, like, like, filter.search);
  }
  const result = await rows<{ total: number }>(
    executor,
    `SELECT COUNT(*) AS total FROM service_requests ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`,
    params,
  );
  return Number(result[0]?.total ?? 0);
};

export const findServiceRequestById = async (
  id: number,
  executor: Executor = getMySql(),
): Promise<ServiceRequestRow | null> => {
  const result = await rows<ServiceRequestRow>(
    executor,
    'SELECT * FROM service_requests WHERE id = ? LIMIT 1',
    [id],
  );
  return result[0] ?? null;
};

export const findServiceFields = async (
  requestId: number,
  executor: Executor = getMySql(),
): Promise<ServiceFieldRow[]> =>
  rows<ServiceFieldRow>(
    executor,
    'SELECT id, request_id, field_key, field_value FROM service_request_fields WHERE request_id = ? ORDER BY field_key',
    [requestId],
  );

export const findServiceDocuments = async (
  requestId: number,
  executor: Executor = getMySql(),
): Promise<ServiceDocumentRow[]> =>
  rows<ServiceDocumentRow>(
    executor,
    'SELECT id, request_id, label, legacy_field, document_id, legacy_path FROM service_documents WHERE request_id = ? ORDER BY label',
    [requestId],
  );

export const findServiceChecks = async (
  requestId: number,
  executor: Executor = getMySql(),
): Promise<ServiceCheckRow[]> =>
  rows<ServiceCheckRow>(
    executor,
    'SELECT * FROM service_request_checks WHERE request_id = ? ORDER BY created_at ASC, id ASC',
    [requestId],
  );

export const findGeneratedLetters = async (
  entityTable: string,
  entityId: number,
  executor: Executor = getMySql(),
): Promise<GeneratedLetterRow[]> =>
  rows<GeneratedLetterRow>(
    executor,
    'SELECT * FROM generated_letters WHERE entity_table = ? AND entity_id = ? ORDER BY created_at ASC, id ASC',
    [entityTable, entityId],
  );

export const findUserProfileById = async (
  userId: number,
  executor: Executor = getMySql(),
): Promise<{
  id: number;
  name: string;
  nip: string | null;
  grade: string | null;
  unit_name: string | null;
  position_name: string | null;
} | null> => {
  const result = await rows<{
    id: number;
    name: string;
    nip: string | null;
    grade: string | null;
    unit_name: string | null;
    position_name: string | null;
  }>(
    executor,
    `SELECT u.id, u.name, u.nip, u.grade, u.unit_name, p.name AS position_name
       FROM users u
       LEFT JOIN positions p ON p.id = u.position_id
      WHERE u.id = ? LIMIT 1`,
    [userId],
  );
  return result[0] ?? null;
};

/** Identitas instansi (kop cetak layanan) tersimpan sebagai settings `instance.*`. */
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
