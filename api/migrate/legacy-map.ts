import { getMySql, type MysqlRow } from '../db/mysql';

/**
 * Pemetaan identitas legacy → target.
 *
 * Tabel `legacy_mappings` adalah satu-satunya sumber kebenaran untuk menjawab
 * "baris legacy X sudah jadi baris target mana?". Script migrasi memakainya
 * supaya idempotent: baris yang sudah dipetakan tidak dibuat ulang, dan proses
 * boleh dijalankan ulang kapan saja (termasuk setelah data legacy bertambah).
 */

export const rememberMapping = async (
  legacyTable: string,
  legacyPk: string,
  targetTable: string,
  targetId: number,
): Promise<void> => {
  await getMySql().query(
    `INSERT INTO legacy_mappings (legacy_table, legacy_pk, target_table, target_id)
     VALUES (?,?,?,?)
     ON DUPLICATE KEY UPDATE target_id = VALUES(target_id)`,
    [legacyTable, legacyPk, targetTable, targetId],
  );
};

export const loadMapping = async (
  legacyTable: string,
  targetTable: string,
): Promise<Map<string, number>> => {
  const [rows] = await getMySql().query<MysqlRow[]>(
    'SELECT legacy_pk, target_id FROM legacy_mappings WHERE legacy_table = ? AND target_table = ?',
    [legacyTable, targetTable],
  );
  const map = new Map<string, number>();
  for (const row of rows as unknown as Array<{ legacy_pk: string; target_id: number }>) {
    map.set(String(row.legacy_pk), Number(row.target_id));
  }
  return map;
};

/** Catat progres per unit kerja migrasi agar bisa dilanjutkan. */
export const recordItem = async (item: {
  kind: 'row';
  sourceTable: string;
  sourceRecordId: string;
  fingerprint?: string | null;
  status: 'pending' | 'uploaded' | 'verified' | 'failed' | 'skipped_missing';
  lastError?: string | null;
}): Promise<void> => {
  await getMySql().query(
    `INSERT INTO migration_items (kind, source_table, source_column, source_record_id, fingerprint, status, attempts, last_error)
     VALUES ('row', ?, NULL, ?, ?, ?, 1, ?)
     ON DUPLICATE KEY UPDATE
       fingerprint = VALUES(fingerprint),
       status = VALUES(status),
       attempts = attempts + 1,
       last_error = VALUES(last_error),
       updated_at = NOW()`,
    [
      item.sourceTable,
      item.sourceRecordId,
      item.fingerprint ?? null,
      item.status,
      item.lastError ?? null,
    ],
  );
};

export const alreadyMigrated = async (
  sourceTable: string,
  sourceRecordId: string,
): Promise<boolean> => {
  const [rows] = await getMySql().query<MysqlRow[]>(
    `SELECT status FROM migration_items
      WHERE kind = 'row' AND source_table = ? AND source_column IS NULL
        AND source_record_id = ? LIMIT 1`,
    [sourceTable, sourceRecordId],
  );
  const row = rows[0] as { status?: string } | undefined;
  return row?.status === 'verified';
};
