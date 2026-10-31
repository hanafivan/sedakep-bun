import { getMySql, type MysqlRow } from '../../../db/mysql';
import type { DocumentRow } from '../schema/types';

/**
 * QUERY = operasi baca modul dokumen. Semua SELECT ada di sini.
 */

export const findDocumentById = async (id: number): Promise<DocumentRow | null> => {
  const [rows] = await getMySql().query<MysqlRow[]>(
    'SELECT * FROM documents WHERE id = ? LIMIT 1',
    [id],
  );
  return (rows[0] as unknown as DocumentRow) ?? null;
};

export const findDocumentsByEntity = async (
  entityTable: string,
  entityId: number,
): Promise<Array<DocumentRow & { field: string; label: string | null }>> => {
  const [rows] = await getMySql().query<MysqlRow[]>(
    `SELECT d.*, l.field, l.label
       FROM document_links l
       JOIN documents d ON d.id = l.document_id
      WHERE l.entity_table = ? AND l.entity_id = ?
      ORDER BY l.field, d.id`,
    [entityTable, entityId],
  );
  return rows as unknown as Array<DocumentRow & { field: string; label: string | null }>;
};

export const countDocumentsByEntity = async (
  entityTable: string,
  entityId: number,
): Promise<number> => {
  const [rows] = await getMySql().query<MysqlRow[]>(
    'SELECT COUNT(*) AS total FROM document_links WHERE entity_table = ? AND entity_id = ?',
    [entityTable, entityId],
  );
  return Number((rows[0] as { total: number }).total);
};

/** Dokumen yang belum tertaut ke entitas mana pun (modul belum diport). */
export const findUnlinkedDocuments = async (limit = 50): Promise<DocumentRow[]> => {
  const [rows] = await getMySql().query<MysqlRow[]>(
    `SELECT d.* FROM documents d
      LEFT JOIN document_links l ON l.document_id = d.id
     WHERE l.id IS NULL
     ORDER BY d.id LIMIT ?`,
    [limit],
  );
  return rows as unknown as DocumentRow[];
};
