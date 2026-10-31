import { getMySql, type MysqlRow } from '../db/mysql';
import { getLegacyMySql } from '../db/legacy-mysql';
import {
  alreadyMigrated,
  recordItem,
  rememberMapping,
} from './legacy-map';

export type LeaveLettersMigrationCounters = {
  suketRead: number;
  suketInserted: number;
  suketSkipped: number;
  suketUnmatched: number;
  suketDuplicates: number;
  suketmadRead: number;
  suketmadInserted: number;
  suketmadSkipped: number;
  suketmadUnmatched: number;
  suketmadDuplicates: number;
  countersSynced: number;
};

/**
 * Migrasi surat keterangan cuti:
 * 1. tbl_suket -> leave_letters (letter_type='suket')
 * 2. tbl_suketmad -> leave_letters (letter_type='suket_madrasah')
 * 3. Sinkronisasi leave_letter_counters per tahun
 */
export const migrateLeaveLetters = async (options: {
  dryRun?: boolean;
  onProgress?: (done: number, total: number) => void;
} = {}): Promise<LeaveLettersMigrationCounters> => {
  const dryRun = options.dryRun ?? false;
  const legacy = getLegacyMySql();
  const app = getMySql();

  const counters: LeaveLettersMigrationCounters = {
    suketRead: 0,
    suketInserted: 0,
    suketSkipped: 0,
    suketUnmatched: 0,
    suketDuplicates: 0,
    suketmadRead: 0,
    suketmadInserted: 0,
    suketmadSkipped: 0,
    suketmadUnmatched: 0,
    suketmadDuplicates: 0,
    countersSynced: 0,
  };

  // 1. Peta legacy_id leave_requests -> id di tabel target
  const [requestRows] = await app.query<MysqlRow[]>(
    `SELECT id, legacy_id, user_id FROM leave_requests WHERE legacy_id IS NOT NULL`,
  );
  const requestByLegacyId = new Map<string, { id: number; userId: number }>();
  for (const row of requestRows as unknown as Array<{ id: number; legacy_id: string; user_id: number }>) {
    requestByLegacyId.set(String(row.legacy_id), { id: Number(row.id), userId: Number(row.user_id) });
  }

  // Peta user legacy -> target
  const [userRows] = await app.query<MysqlRow[]>(
    `SELECT legacy_pk, target_id FROM legacy_mappings WHERE legacy_table = 'tbl_user' AND target_table = 'users'`,
  );
  const userMap = new Map<string, number>();
  for (const row of userRows as unknown as Array<{ legacy_pk: string; target_id: number }>) {
    userMap.set(String(row.legacy_pk), Number(row.target_id));
  }

  // -------------------------------------------------------------------------
  // A. Migrasi tbl_suket
  // -------------------------------------------------------------------------
  const [suketRows] = await legacy.query<MysqlRow[]>(
    `SELECT * FROM tbl_suket ORDER BY id_suket ASC`,
  );
  const allSuket = suketRows as unknown as Array<Record<string, unknown>>;
  counters.suketRead = allSuket.length;

  // Deduplikasi per id_surat: ambil baris dengan id_suket terbesar
  const latestSuketBySurat = new Map<number, Record<string, unknown>>();
  for (const row of allSuket) {
    const idSurat = Number(row.id_surat);
    if (latestSuketBySurat.has(idSurat)) {
      counters.suketDuplicates += 1;
    }
    latestSuketBySurat.set(idSurat, row);
  }

  for (const row of latestSuketBySurat.values()) {
    const legacyId = String(row.id_suket);
    const idSurat = String(row.id_surat);

    if (!dryRun && (await alreadyMigrated('tbl_suket', legacyId))) {
      counters.suketSkipped += 1;
      continue;
    }

    const matchedRequest = requestByLegacyId.get(idSurat);
    if (!matchedRequest) {
      counters.suketUnmatched += 1;
      if (!dryRun) {
        await recordItem({
          kind: 'row',
          sourceTable: 'tbl_suket',
          sourceRecordId: legacyId,
          status: 'failed',
          lastError: `id_surat ${idSurat} tidak ditemukan di leave_requests`,
        });
      }
      continue;
    }

    const userId = userMap.get(String(row.id_user)) ?? matchedRequest.userId;
    const issuedAt = row.tgl_cetak ? String(row.tgl_cetak).slice(0, 10) : null;
    const number = String(row.nomor ?? '');

    if (dryRun) {
      counters.suketInserted += 1;
      continue;
    }

    const [insert] = await app.query<MysqlRow[]>(
      `INSERT INTO leave_letters (
         leave_request_id, letter_type, number, issued_at,
         official_position, official_name, legacy_id, created_by
       ) VALUES (?, 'suket', ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         number = VALUES(number),
         issued_at = VALUES(issued_at),
         official_position = VALUES(official_position),
         official_name = VALUES(official_name),
         legacy_id = VALUES(legacy_id)`,
      [
        matchedRequest.id,
        number || null,
        issuedAt,
        row.pejabat ? String(row.pejabat) : null,
        row.nama_pejabat ? String(row.nama_pejabat) : null,
        legacyId,
        userId,
      ],
    );

    const insertId = Number((insert as unknown as { insertId: number }).insertId);
    await rememberMapping('tbl_suket', legacyId, 'leave_letters', insertId);
    await recordItem({
      kind: 'row',
      sourceTable: 'tbl_suket',
      sourceRecordId: legacyId,
      status: 'verified',
    });
    counters.suketInserted += 1;
  }

  // -------------------------------------------------------------------------
  // B. Migrasi tbl_suketmad
  // -------------------------------------------------------------------------
  const [suketmadRows] = await legacy.query<MysqlRow[]>(
    `SELECT * FROM tbl_suketmad ORDER BY id_suketmad ASC`,
  );
  const allSuketmad = suketmadRows as unknown as Array<Record<string, unknown>>;
  counters.suketmadRead = allSuketmad.length;

  const latestMadBySurat = new Map<number, Record<string, unknown>>();
  for (const row of allSuketmad) {
    const idSurat = Number(row.id_surat);
    if (latestMadBySurat.has(idSurat)) {
      counters.suketmadDuplicates += 1;
    }
    latestMadBySurat.set(idSurat, row);
  }

  for (const row of latestMadBySurat.values()) {
    const legacyId = String(row.id_suketmad);
    const idSurat = String(row.id_surat);

    if (!dryRun && (await alreadyMigrated('tbl_suketmad', legacyId))) {
      counters.suketmadSkipped += 1;
      continue;
    }

    const matchedRequest = requestByLegacyId.get(idSurat);
    if (!matchedRequest) {
      counters.suketmadUnmatched += 1;
      if (!dryRun) {
        await recordItem({
          kind: 'row',
          sourceTable: 'tbl_suketmad',
          sourceRecordId: legacyId,
          status: 'failed',
          lastError: `id_surat ${idSurat} tidak ditemukan di leave_requests`,
        });
      }
      continue;
    }

    const userId = userMap.get(String(row.id_user)) ?? matchedRequest.userId;

    if (dryRun) {
      counters.suketmadInserted += 1;
      continue;
    }

    const [insert] = await app.query<MysqlRow[]>(
      `INSERT INTO leave_letters (
         leave_request_id, letter_type, number, issued_at,
         official_position, official_name, legacy_id, created_by
       ) VALUES (?, 'suket_madrasah', NULL, NULL, NULL, NULL, ?, ?)
       ON DUPLICATE KEY UPDATE
         legacy_id = VALUES(legacy_id)`,
      [matchedRequest.id, legacyId, userId],
    );

    const insertId = Number((insert as unknown as { insertId: number }).insertId);
    await rememberMapping('tbl_suketmad', legacyId, 'leave_letters', insertId);
    await recordItem({
      kind: 'row',
      sourceTable: 'tbl_suketmad',
      sourceRecordId: legacyId,
      status: 'verified',
    });
    counters.suketmadInserted += 1;
  }

  // -------------------------------------------------------------------------
  // C. Sinkronisasi Counter Nomor SK (leave_letter_counters)
  // -------------------------------------------------------------------------
  const [maxPerYear] = await legacy.query<MysqlRow[]>(
    `SELECT YEAR(tgl_cetak) AS yr, MAX(nomor) AS max_num
       FROM tbl_suket
      WHERE tgl_cetak IS NOT NULL
      GROUP BY YEAR(tgl_cetak)
      ORDER BY yr ASC`,
  );

  for (const item of maxPerYear as unknown as Array<{ yr: number; max_num: number }>) {
    if (!item.yr || !item.max_num) continue;
    if (!dryRun) {
      await app.query(
        `INSERT INTO leave_letter_counters (letter_type, year, last_number)
         VALUES ('suket', ?, ?)
         ON DUPLICATE KEY UPDATE last_number = GREATEST(last_number, VALUES(last_number))`,
        [item.yr, item.max_num],
      );
    }
    counters.countersSynced += 1;
  }

  return counters;
};
