import { getMySql } from '../../../db/mysql';
import { rows, type Executor } from '../../../shared/db';
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

export { findInstanceProfile, findUserProfileById } from '../../../shared/db';

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

/** Profil user & instansi — re-exported dari shared/db. */
