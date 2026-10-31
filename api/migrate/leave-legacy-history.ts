import { getMySql, type MysqlRow } from '../db/mysql';
import { getLegacyMySql } from '../db/legacy-mysql';
import { rememberMapping } from './legacy-map';

/**
 * Migrasi riwayat cuti 2019: `tbl_n2019` → `leave_legacy_history`.
 *
 * Kenapa tabel terpisah, bukan `leave_requests`:
 * `leave_requests` adalah sumber replay kuota. Memasukkan cuti 2019 ke sana
 * akan menambah pemakaian pool 2019 dan mengubah carry-over 2020/2021 —
 * angka yang sudah diverifikasi cocok dengan legacy. Baris 2019 di sini hanya
 * dibaca untuk buku cuti lama dan rekap, jadi bentuknya tabel riwayat
 * tersendiri tanpa efek kuota.
 *
 * Kolom legacy yang dipakai:
 *  - `nomor` (PK, int) → `legacy_id`
 *  - `nip` (bigint) → user lewat `users.nip`
 *  - `jenis_cuti`, `lama_cuti`, `satuan`
 *  - `tgl_mulai`, `tgl_selesai`, `tgl_cetak` (semua varchar 'YYYY-MM-DD')
 */

export type LegacyHistoryCounters = {
  read: number;
  inserted: number;
  skipped: number;
  unmatchedUser: number;
  invalidDate: number;
  invalidDuration: number;
};

const asDate = (value: unknown): string | null => {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
};

const asDuration = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0;
};

export const migrateLeaveLegacyHistory = async (options: {
  dryRun?: boolean;
  onProgress?: (done: number, total: number) => void;
} = {}): Promise<LegacyHistoryCounters> => {
  const dryRun = options.dryRun ?? false;
  const legacy = getLegacyMySql();
  const app = getMySql();

  const counters: LegacyHistoryCounters = {
    read: 0,
    inserted: 0,
    skipped: 0,
    unmatchedUser: 0,
    invalidDate: 0,
    invalidDuration: 0,
  };

  // NIP legacy disimpan sebagai bigint, jadi dibaca sebagai string agar tidak
  // kehilangan digit dan bisa dicocokkan apa adanya dengan users.nip.
  const [nipRows] = await app.query<MysqlRow[]>('SELECT id, nip FROM users WHERE nip IS NOT NULL');
  const userIdByNip = new Map<string, number>();
  for (const row of nipRows as unknown as Array<{ id: number; nip: string }>) {
    userIdByNip.set(String(row.nip).trim(), Number(row.id));
  }

  const [rows] = await legacy.query<MysqlRow[]>(
    `SELECT nomor, nama, CAST(nip AS CHAR) AS nip, jenis_cuti, tgl_cetak,
            lama_cuti, satuan, tgl_mulai, tgl_selesai
       FROM tbl_n2019
      ORDER BY nomor ASC`,
  );
  const list = rows as unknown as Array<Record<string, unknown>>;
  counters.read = list.length;

  const [existing] = await app.query<MysqlRow[]>(
    "SELECT legacy_id FROM leave_legacy_history WHERE source_table = 'tbl_n2019'",
  );
  const already = new Set(
    (existing as unknown as Array<{ legacy_id: string }>).map((row) => String(row.legacy_id)),
  );

  let done = 0;
  for (const row of list) {
    done += 1;
    const legacyId = String(row.nomor ?? '');
    const nip = String(row.nip ?? '').trim();
    const userId = nip ? userIdByNip.get(nip) : undefined;

    if (!userId) {
      counters.unmatchedUser += 1;
      options.onProgress?.(done, list.length);
      continue;
    }
    if (already.has(legacyId)) {
      counters.skipped += 1;
      options.onProgress?.(done, list.length);
      continue;
    }

    const startDate = asDate(row.tgl_mulai);
    const endDate = asDate(row.tgl_selesai);
    const issuedAt = asDate(row.tgl_cetak);
    if (!startDate) counters.invalidDate += 1;

    const duration = asDuration(row.lama_cuti);
    if (duration === 0) counters.invalidDuration += 1;

    if (!dryRun) {
      await app.query(
        `INSERT INTO leave_legacy_history
           (user_id, legacy_id, year, leave_type, duration, duration_unit,
            start_date, end_date, number, issued_at, source_table)
         VALUES (?,?,?,?,?,?,?,?,?,?,'tbl_n2019')
         ON DUPLICATE KEY UPDATE
           user_id = VALUES(user_id), year = VALUES(year), leave_type = VALUES(leave_type),
           duration = VALUES(duration), duration_unit = VALUES(duration_unit),
           start_date = VALUES(start_date), end_date = VALUES(end_date),
           number = VALUES(number), issued_at = VALUES(issued_at)`,
        [
          userId,
          legacyId,
          Number((startDate ?? issuedAt ?? '2019-01-01').slice(0, 4)),
          String(row.jenis_cuti ?? 'Cuti Tahunan').trim(),
          duration,
          String(row.satuan ?? 'Hari').trim() === 'Bulan' ? 'month' : 'day',
          startDate,
          endDate,
          null,
          issuedAt,
        ],
      );
      await rememberMapping('tbl_n2019', legacyId, 'leave_legacy_history', userId);
    }
    counters.inserted += 1;
    options.onProgress?.(done, list.length);
  }

  return counters;
};
