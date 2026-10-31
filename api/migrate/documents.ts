import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { getMySql, type MysqlRow } from '../db/mysql';
import { getLegacyMySql } from '../db/legacy-mysql';
import { getStorage } from '../shared/storage';
import { ensureBucket } from '../shared/storage-bucket';
import { logger } from '../shared/logger';
import {
  DOCUMENT_SOURCES,
  fingerprintOf,
  legacyFileRoot,
  objectKeyFor,
  sanitizeFilename,
  type DocumentSource,
} from './document-sources';

/**
 * Migrasi dokumen legacy (filesystem) → MinIO + tabel `documents`.
 *
 * Sifat:
 *  - idempotent: identity unik `(source_table, source_column, source_record_id)`
 *    di `migration_items` mencegah object dibuat dua kali;
 *  - resumable: baris berstatus `verified` dilewati, jadi aman dijalankan ulang
 *    walau ada file baru selama proses berjalan;
 *  - aman saat file hilang: dicatat `skipped_missing`, tidak menghentikan batch;
 *  - file sumber tidak pernah dihapus.
 */

export type DocumentCounters = {
  scanned: number;
  uploaded: number;
  reused: number;
  skippedMissing: number;
  skippedUnmapped: number;
  failed: number;
  bytes: number;
};

const emptyCounters = (): DocumentCounters => ({
  scanned: 0,
  uploaded: 0,
  reused: 0,
  skippedMissing: 0,
  skippedUnmapped: 0,
  failed: 0,
  bytes: 0,
});

/** SHA-256 dari file, streaming supaya file besar tidak masuk memory. */
const sha256File = (filePath: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });

const exists = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

type ItemRow = {
  id: number;
  source_record_id: string;
  legacy_path: string | null;
  fingerprint: string | null;
  file_size: number | null;
  document_id: number | null;
  object_key: string | null;
  status: string;
};

const loadItems = async (table: string, column: string): Promise<Map<string, ItemRow>> => {
  const [rows] = await getMySql().query<MysqlRow[]>(
    `SELECT id, source_record_id, legacy_path, fingerprint, file_size, document_id, object_key, status
       FROM migration_items
      WHERE kind = 'document' AND source_table = ? AND source_column = ?`,
    [table, column],
  );
  const map = new Map<string, ItemRow>();
  for (const row of rows as unknown as ItemRow[]) {
    map.set(String(row.source_record_id), row);
  }
  return map;
};

/**
 * Cari entitas target untuk sebuah baris legacy.
 * Mengembalikan `null` kalau modulnya belum diport — dokumen tetap dipindah,
 * hanya tautannya ditunda.
 */
const findEntityId = async (
  source: DocumentSource,
  legacyId: string,
): Promise<{ entityTable: string; entityId: number } | null> => {
  if (source.target === 'unmapped') return null;

  if (source.target === 'leave_letter') {
    const letterType = source.table === 'tbl_suketmad' ? 'suket_madrasah' : 'suket';
    const [rows] = await getMySql().query<MysqlRow[]>(
      `SELECT id FROM leave_letters WHERE legacy_id = ? AND letter_type = ? LIMIT 1`,
      [legacyId, letterType],
    );
    const id = (rows[0] as { id?: number } | undefined)?.id;
    if (!id) return null;
    return { entityTable: source.entityTable, entityId: Number(id) };
  }

  const lookup: Record<string, string> = {
    leave_request: 'leave_requests',
    service_request: 'service_requests',
    incoming_letter: 'incoming_letters',
    assignment: 'assignment_letters',
    alibi: 'alibi_requests',
  };
  const table = lookup[source.target];
  if (!table) return null;

  const [rows] = await getMySql().query<MysqlRow[]>(
    `SELECT id FROM ${table} WHERE legacy_id = ? LIMIT 1`,
    [legacyId],
  );
  const id = (rows[0] as { id?: number } | undefined)?.id;
  if (!id) return null;
  return { entityTable: source.entityTable, entityId: Number(id) };
};

const upsertDocument = async (data: {
  bucket: string;
  objectKey: string;
  originalFilename: string;
  mimeType: string | undefined;
  extension: string;
  sizeBytes: number;
  sha256: string;
  status: 'stored' | 'verified';
}): Promise<number> => {
  const [result] = await getMySql().query<MysqlRow[]>(
    `INSERT INTO documents
       (bucket, object_key, original_filename, mime_type, extension, size_bytes, sha256,
        checksum_verified, status)
     VALUES (?,?,?,?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE
       original_filename = VALUES(original_filename),
       mime_type = VALUES(mime_type),
       size_bytes = VALUES(size_bytes),
       sha256 = VALUES(sha256),
       checksum_verified = VALUES(checksum_verified),
       status = VALUES(status)`,
    [
      data.bucket,
      data.objectKey,
      data.originalFilename,
      data.mimeType ?? null,
      data.extension,
      data.sizeBytes,
      data.sha256,
      data.status === 'verified' ? 1 : 0,
      data.status,
    ],
  );
  const header = result as unknown as { insertId: number };
  if (header.insertId) return Number(header.insertId);

  const [existing] = await getMySql().query<MysqlRow[]>(
    'SELECT id FROM documents WHERE bucket = ? AND object_key = ? LIMIT 1',
    [data.bucket, data.objectKey],
  );
  return Number((existing[0] as { id?: number }).id ?? 0);
};

const upsertItem = async (data: {
  sourceTable: string;
  sourceColumn: string;
  sourceRecordId: string;
  legacyPath: string | null;
  fingerprint: string | null;
  fileSize: number | null;
  documentId: number | null;
  objectKey: string | null;
  status: 'pending' | 'uploaded' | 'verified' | 'failed' | 'skipped_missing' | 'orphan_file';
  error?: string | null;
}): Promise<void> => {
  await getMySql().query(
    `INSERT INTO migration_items
       (kind, source_table, source_column, source_record_id, legacy_path, fingerprint,
        file_size, document_id, object_key, status, attempts, last_error, verified_at)
     VALUES ('document',?,?,?,?,?,?,?,?,?,1,?, IF(? = 'verified', NOW(), NULL))
     ON DUPLICATE KEY UPDATE
       legacy_path = VALUES(legacy_path),
       fingerprint = VALUES(fingerprint),
       file_size = VALUES(file_size),
       document_id = VALUES(document_id),
       object_key = VALUES(object_key),
       status = VALUES(status),
       attempts = attempts + 1,
       last_error = VALUES(last_error),
       verified_at = IF(VALUES(status) = 'verified', NOW(), verified_at),
       updated_at = NOW()`,
    [
      data.sourceTable,
      data.sourceColumn,
      data.sourceRecordId,
      data.legacyPath,
      data.fingerprint,
      data.fileSize,
      data.documentId,
      data.objectKey,
      data.status,
      data.error ?? null,
      data.status,
    ],
  );
};

const linkDocument = async (
  documentId: number,
  entityTable: string,
  entityId: number,
  field: string,
  label: string,
): Promise<void> => {
  await getMySql().query(
    `INSERT INTO document_links (document_id, entity_table, entity_id, field, label)
     VALUES (?,?,?,?,?)
     ON DUPLICATE KEY UPDATE label = VALUES(label)`,
    [documentId, entityTable, entityId, field, label],
  );
  if (entityTable === 'leave_letters') {
    await getMySql().query(
      `UPDATE leave_letters SET document_id = ? WHERE id = ?`,
      [documentId, entityId],
    );
  }
};

export type MigrateDocumentsOptions = {
  dryRun?: boolean;
  /** Batasi ke satu tabel legacy saja. */
  onlyTable?: string;
  /** Coba ulang baris yang sebelumnya gagal. */
  retryFailed?: boolean;
  /** Hanya periksa checksum object yang sudah ada, tanpa upload. */
  verifyOnly?: boolean;
  onProgress?: (source: string, done: number, total: number) => void;
};

export const migrateDocuments = async (
  options: MigrateDocumentsOptions = {},
): Promise<DocumentCounters> => {
  const dryRun = options.dryRun ?? false;
  const storage = getStorage();
  const bucket = (storage as unknown as { bucket?: string }).bucket ?? 'sedakep-documents';
  const totals = emptyCounters();

  if (!dryRun) await ensureBucket(storage);

  const sources = options.onlyTable
    ? DOCUMENT_SOURCES.filter((source) => source.table === options.onlyTable)
    : DOCUMENT_SOURCES;

  for (const source of sources) {
    const [rows] = await getLegacyMySql().query<MysqlRow[]>(
      `SELECT id_pk, ${source.column} AS filename FROM (
         SELECT *, ${primaryKeyOf(source.table)} AS id_pk FROM ${source.table}
       ) t WHERE TRIM(COALESCE(filename, '')) <> ''`,
    ).catch(async () => {
      // Tabel tanpa PK tunggal yang kita kenal: baca kolom PK dari metadata.
      const [pkRows] = await getLegacyMySql().query<MysqlRow[]>(
        `SELECT COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
            AND CONSTRAINT_NAME = 'PRIMARY' LIMIT 1`,
        [source.table],
      );
      const pk = String((pkRows[0] as { COLUMN_NAME?: string })?.COLUMN_NAME ?? 'id');
      return getLegacyMySql().query<MysqlRow[]>(
        `SELECT ${pk} AS id_pk, ${source.column} AS filename FROM ${source.table}
          WHERE TRIM(COALESCE(${source.column}, '')) <> ''`,
      );
    });

    const list = rows as unknown as Array<{ id_pk: number; filename: string }>;
    const items = dryRun ? new Map<string, ItemRow>() : await loadItems(source.table, source.column);
    const directory = legacyFileRoot(source.directory);

    let done = 0;
    for (const record of list) {
      done += 1;
      totals.scanned += 1;
      options.onProgress?.(`${source.table}.${source.column}`, done, list.length);

      const legacyId = String(record.id_pk);
      const existing = items.get(legacyId);
      const retryable = !existing || existing.status !== 'verified';
      if (!retryable && !options.retryFailed) continue;

      const filename = sanitizeFilename(String(record.filename));
      const filePath = join(directory, filename);
      const objectKey = objectKeyFor({
        table: source.table,
        column: source.column,
        recordId: legacyId,
        filename,
        module: source.module,
      });

      if (!(await exists(filePath))) {
        totals.skippedMissing += 1;
        if (!dryRun) {
          await upsertItem({
            sourceTable: source.table,
            sourceColumn: source.column,
            sourceRecordId: legacyId,
            legacyPath: `${source.directory}/${filename}`,
            fingerprint: null,
            fileSize: null,
            documentId: existing?.document_id ?? null,
            objectKey,
            status: 'skipped_missing',
            error: 'File tidak ada di filesystem legacy',
          });
        }
        continue;
      }

      const info = await stat(filePath);
      const sha256 = await sha256File(filePath);
      const fingerprint = fingerprintOf({
        sourceTable: source.table,
        sourceRecordId: legacyId,
        sourceColumn: source.column,
        legacyPath: `${source.directory}/${filename}`,
        fileSize: info.size,
        sha256,
      });

      // Sudah pernah dipindah dengan isi identik → tidak perlu upload ulang.
      const unchanged = existing?.status === 'verified' && existing.fingerprint === fingerprint;
      if (unchanged && !options.retryFailed) {
        totals.reused += 1;
        continue;
      }

      if (dryRun) {
        totals.uploaded += 1;
        totals.bytes += info.size;
        continue;
      }

      if (options.verifyOnly) {
        const head = await storage.head(objectKey);
        if (!head) {
          await upsertItem({
            sourceTable: source.table,
            sourceColumn: source.column,
            sourceRecordId: legacyId,
            legacyPath: `${source.directory}/${filename}`,
            fingerprint,
            fileSize: info.size,
            documentId: existing?.document_id ?? null,
            objectKey,
            status: 'failed',
            error: 'Object tidak ada di storage',
          });
          totals.failed += 1;
          continue;
        }
        if (head.sizeBytes !== info.size) {
          await upsertItem({
            sourceTable: source.table,
            sourceColumn: source.column,
            sourceRecordId: legacyId,
            legacyPath: `${source.directory}/${filename}`,
            fingerprint,
            fileSize: info.size,
            documentId: existing?.document_id ?? null,
            objectKey,
            status: 'failed',
            error: `Ukuran beda: storage ${head.sizeBytes} vs sumber ${info.size}`,
          });
          totals.failed += 1;
          continue;
        }
        totals.reused += 1;
        continue;
      }

      try {
        // HEAD dulu: hindari upload ulang object yang sudah ada dengan ukuran sama.
        const head = await storage.head(objectKey);
        if (head && head.sizeBytes === info.size && unchanged) {
          totals.reused += 1;
          continue;
        }

        await storage.putFromFile(filePath, objectKey);
        const uploaded = await storage.head(objectKey);
        if (!uploaded) throw new Error('Object tidak ditemukan setelah upload');

        const documentId = await upsertDocument({
          bucket,
          objectKey,
          originalFilename: filename,
          mimeType: uploaded.contentType,
          extension: filename.split('.').pop()?.toLowerCase() ?? '',
          sizeBytes: info.size,
          sha256,
          status: 'verified',
        });

        const link = await findEntityId(source, legacyId);
        if (link) {
          await linkDocument(
            documentId,
            link.entityTable,
            link.entityId,
            source.column,
            `${source.module}:${source.column}`,
          );
        } else {
          totals.skippedUnmapped += 1;
        }

        await upsertItem({
          sourceTable: source.table,
          sourceColumn: source.column,
          sourceRecordId: legacyId,
          legacyPath: `${source.directory}/${filename}`,
          fingerprint,
          fileSize: info.size,
          documentId,
          objectKey,
          status: 'verified',
        });

        totals.uploaded += 1;
        totals.bytes += info.size;
      } catch (error) {
        totals.failed += 1;
        logger.error('migrate:documents', `${source.table}#${legacyId}: ${(error as Error).message}`);
        await upsertItem({
          sourceTable: source.table,
          sourceColumn: source.column,
          sourceRecordId: legacyId,
          legacyPath: `${source.directory}/${filename}`,
          fingerprint,
          fileSize: info.size,
          documentId: existing?.document_id ?? null,
          objectKey,
          status: 'failed',
          error: (error as Error).message.slice(0, 500),
        });
      }
    }

    process.stdout.write('\r');
    logger.info('migrate:documents', `selesai ${source.table}.${source.column}`, {
      total: list.length,
    });
  }

  return totals;
};

/** PK tunggal per tabel legacy (semua tabel di daftar ini punya PK tunggal). */
const primaryKeyOf = (table: string): string => {
  const map: Record<string, string> = {
    tbl_surat_masuk: 'id_surat',
    hlm_edispo: 'id_edispo',
    hlm_surtug: 'id_surtug',
    hlm_alibi_acc: 'id_acc',
    tbl_suket: 'id_suket',
    tbl_suketmad: 'id_suketmad',
    hlm_gelar_acc: 'id_acc',
    hlm_ibel_acc: 'id_acc',
    hlm_karpeg_acc: 'id_acc',
    hlm_karisu_acc: 'id_acc',
    hlm_bpjs_acc: 'id_acc',
    hlm_taspen_acc: 'id_acc',
    hlm_pangkat_sk: 'id_sk',
    tbl_pmk: 'id_pmk',
    tbl_skmi_skpp: 'id_skmi_skpp',
    hlm_pens_reg_usul: 'id_usul',
    hlm_pens_reg_acc: 'id_acc',
    hlm_pens_reg_suket: 'id_suket',
  };
  return map[table] ?? 'id';
};

/** Ringkasan status migrasi dokumen. */
export const documentMigrationSummary = async (): Promise<{
  byStatus: Record<string, number>;
  totalBytes: number;
  orphanFiles: number;
}> => {
  const [statusRows] = await getMySql().query<MysqlRow[]>(
    `SELECT status, COUNT(*) AS total FROM migration_items WHERE kind = 'document' GROUP BY status`,
  );
  const byStatus: Record<string, number> = {};
  for (const row of statusRows as unknown as Array<{ status: string; total: number }>) {
    byStatus[row.status] = Number(row.total);
  }

  const [bytes] = await getMySql().query<MysqlRow[]>(
    'SELECT COALESCE(SUM(size_bytes), 0) AS total FROM documents',
  );

  const [orphan] = await getMySql().query<MysqlRow[]>(
    `SELECT COUNT(*) AS total FROM migration_items WHERE kind = 'document' AND status = 'orphan_file'`,
  );

  return {
    byStatus,
    totalBytes: Number((bytes[0] as { total: number }).total),
    orphanFiles: Number((orphan[0] as { total: number }).total),
  };
};
