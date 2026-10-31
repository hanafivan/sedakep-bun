import type { PoolConnection } from 'mysql2/promise';
import { getMySql } from '../../../db/mysql';

/**
 * COMMAND = operasi tulis modul dokumen.
 * Query SQL INSERT/UPDATE/DELETE untuk dokumen dan tautannya ada di sini.
 */

type Executor = PoolConnection | ReturnType<typeof getMySql>;

export const insertDocument = async (
  data: {
    object_key: string;
    original_filename: string;
    mime_type?: string | null;
    extension?: string | null;
    size_bytes?: number | null;
    sha256?: string | null;
    status?: string;
    bucket?: string | null;
  },
  executor: Executor = getMySql(),
): Promise<number> => {
  const [result] = await executor.execute<import('mysql2/promise').ResultSetHeader>(
    `INSERT INTO documents
       (bucket, object_key, original_filename, mime_type, extension, size_bytes, sha256, status)
     VALUES (?,?,?,?,?,?,?,?)`,
    [
      data.bucket ?? null,
      data.object_key,
      data.original_filename,
      data.mime_type ?? null,
      data.extension ?? null,
      data.size_bytes ?? null,
      data.sha256 ?? null,
      data.status ?? 'stored',
    ],
  );
  return result.insertId;
};

export const linkDocument = async (
  data: {
    documentId: number;
    entityTable: string;
    entityId: number;
    field: string;
    label?: string | null;
  },
  executor: Executor = getMySql(),
): Promise<void> => {
  await executor.query(
    `INSERT INTO document_links (document_id, entity_table, entity_id, field, label)
     VALUES (?,?,?,?,?)
     ON DUPLICATE KEY UPDATE label = VALUES(label)`,
    [data.documentId, data.entityTable, data.entityId, data.field, data.label ?? null],
  );
};

export const unlinkDocument = async (
  id: number,
  executor: Executor = getMySql(),
): Promise<void> => {
  await executor.query('DELETE FROM document_links WHERE id = ?', [id]);
};

/** Hapus dokumen beserta tautannya; baris objek di MinIO diurus service. */
export const deleteDocument = async (
  id: number,
  executor: Executor = getMySql(),
): Promise<void> => {
  await executor.query('DELETE FROM document_links WHERE document_id = ?', [id]);
  await executor.query('DELETE FROM documents WHERE id = ?', [id]);
};

export const markDocumentStatus = async (
  id: number,
  status: 'pending' | 'uploading' | 'stored' | 'verified' | 'failed' | 'missing',
  executor: Executor = getMySql(),
): Promise<void> => {
  await executor.query('UPDATE documents SET status = ? WHERE id = ?', [status, id]);
};
