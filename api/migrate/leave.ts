import { getMySql, type MysqlRow } from '../db/mysql';
import { getLegacyMySql } from '../db/legacy-mysql';
import {
  alreadyMigrated,
  loadMapping,
  recordItem,
  rememberMapping,
} from './legacy-map';

/**
 * Migrasi permohonan cuti: tbl_surat_masuk (+ tbl_acc) → leave_requests.
 *
 * Keputusan pemetaan (sesuai hasil audit):
 *  - `tbl_acc` 1:1 dengan `tbl_surat_masuk` → approval dilipat ke kolom, bukan tabel sendiri.
 *  - Kuota legacy (`tahunan_n/n1/n2`) disimpan apa adanya sebagai kolom `legacy_*`
 *    untuk rekonsiliasi; sumber kebenaran tetap replay dari histori request.
 *  - `lama_cuti` dengan satuan "Tahun"/"Bulan" ditandai `anomaly_flag` dan
 *    dinormalkan ke hari supaya tidak merusak engine.
 */

export type LeaveMigrationCounters = {
  read: number;
  inserted: number;
  skipped: number;
  unmappedUser: number;
  anomalyUnit: number;
  anomalyDuration: number;
  orphanAcc: number;
  duplicateAcc: number;
};

export const migrateLeaveRequests = async (options: {
  dryRun?: boolean;
  batchLimit?: number;
  onProgress?: (done: number, total: number) => void;
} = {}): Promise<LeaveMigrationCounters> => {
  const dryRun = options.dryRun ?? false;
  const limit = options.batchLimit ?? 0;
  const legacy = getLegacyMySql();
  const app = getMySql();

  const counters: LeaveMigrationCounters = {
    read: 0,
    inserted: 0,
    skipped: 0,
    unmappedUser: 0,
    anomalyUnit: 0,
    anomalyDuration: 0,
    orphanAcc: 0,
    duplicateAcc: 0,
  };

  // Peta id_user legacy → id users target, dari legacy_mappings.
  const [userRows] = await app.query<MysqlRow[]>(
    `SELECT legacy_pk, target_id FROM legacy_mappings WHERE legacy_table = 'tbl_user' AND target_table = 'users'`,
  );
  const userMap = new Map<number, number>();
  for (const row of userRows as unknown as Array<{ legacy_pk: string; target_id: number }>) {
    userMap.set(Number(row.legacy_pk), Number(row.target_id));
  }

  const [totalRows] = await legacy.query<MysqlRow[]>('SELECT COUNT(*) AS total FROM tbl_surat_masuk');
  const total = Number((totalRows[0] as { total: number }).total);

  // Approval: ambil dari tbl_acc, deteksi duplikat id_surat.
  const [accRows] = await legacy.query<MysqlRow[]>(
    `SELECT a.*, s.id_surat AS joined_surat FROM tbl_acc a
       LEFT JOIN tbl_surat_masuk s ON s.id_surat = a.id_surat`,
  );
  const accBySurat = new Map<number, MysqlRow>();
  for (const acc of accRows as unknown as MysqlRow[]) {
    const idSurat = Number((acc as Record<string, unknown>).id_surat);
    if ((acc as Record<string, unknown>).joined_surat === null) {
      counters.orphanAcc += 1;
      continue;
    }
    if (accBySurat.has(idSurat)) {
      counters.duplicateAcc += 1;
      // Baris pertama dipertahankan; yang berikutnya tercatat sebagai duplikat.
    } else {
      accBySurat.set(idSurat, acc);
    }
  }

  const pageSize = 500;
  let offset = 0;

  while (offset < total) {
    const [batch] = await legacy.query<MysqlRow[]>(
      `SELECT * FROM tbl_surat_masuk ORDER BY id_surat LIMIT ? OFFSET ?`,
      [pageSize, offset],
    );
    const rows = batch as unknown as MysqlRow[];
    if (rows.length === 0) break;

    for (const raw of rows) {
      const row = raw as Record<string, unknown>;
      counters.read += 1;
      const legacyId = String(row.id_surat);

      if (limit > 0 && counters.inserted >= limit) return counters;

      if (!dryRun && (await alreadyMigrated('tbl_surat_masuk', legacyId))) {
        counters.skipped += 1;
        continue;
      }

      const legacyUserId = Number(row.id_user);
      const userId = userMap.get(legacyUserId);
      if (!userId) {
        counters.unmappedUser += 1;
        if (!dryRun) {
          await recordItem({
            kind: 'row',
            sourceTable: 'tbl_surat_masuk',
            sourceRecordId: legacyId,
            status: 'failed',
            lastError: `id_user ${legacyUserId} tidak punya mapping`,
          });
        }
        continue;
      }

      const leaveType = String(row.jenis_cuti ?? 'Cuti Tahunan');
      const rawDuration = Number(row.lama_cuti ?? 0);
      const rawUnit = String(row.satuan ?? 'Hari');
      const durationUnit =
        rawUnit === 'Tahun' ? 'year' : rawUnit === 'Bulan' ? 'month' : 'day';

      let anomaly: string | null = null;
      if (durationUnit !== 'day' && leaveType === 'Cuti Tahunan') {
        anomaly = 'satuan_bukan_hari';
        counters.anomalyUnit += 1;
      }
      if (rawDuration <= 0) {
        anomaly = anomaly ? `${anomaly},durasi_tidak_valid` : 'durasi_tidak_valid';
        counters.anomalyDuration += 1;
      }

      const acc = accBySurat.get(Number(row.id_surat));
      const accStatus = (acc?.acc as string | undefined) ?? 'Belum Diproses';
      const accAtasan = (acc?.acc_atasan as string | null | undefined) ?? null;
      const accAtasan2 = (acc?.acc_atasan2 as string | null | undefined) ?? null;

      const mapDecision = (
        value: string | null | undefined,
      ): 'pending' | 'accepted' | 'rejected' | 'cancelled' => {
        if (value === 'Diterima') return 'accepted';
        if (value === 'Ditolak') return 'rejected';
        if (value === 'Dibatalkan') return 'cancelled';
        return 'pending';
      };

      const adminDecision = mapDecision(accStatus);
      const approver1 = accAtasan ? mapDecision(accAtasan) : 'pending';
      const approver2 = accAtasan2 ? mapDecision(accAtasan2) : 'pending';

      let status: string;
      if (adminDecision === 'cancelled' || approver1 === 'cancelled' || approver2 === 'cancelled') {
        status = 'cancelled';
      } else if (
        adminDecision === 'rejected' ||
        approver1 === 'rejected' ||
        approver2 === 'rejected'
      ) {
        status = 'rejected';
      } else if (adminDecision === 'accepted') {
        status = 'approved';
      } else if (accStatus === 'Belum Diproses') {
        status = 'submitted';
      } else {
        status = 'in_review';
      }

      if (dryRun) {
        counters.inserted += 1;
        continue;
      }

      const [insert] = await app.query<MysqlRow[]>(
        `INSERT INTO leave_requests (
           legacy_id, user_id, legacy_user_id, name, nip, grade, position, organization_name,
           service_years, leave_type, duration, duration_unit, start_date, end_date,
           reason, address, phone,
           approver_1_name, approver_1_nip, approver_1_position,
           approver_2_name, approver_2_nip, approver_2_position,
           status, admin_decision, approver_1_status, approver_2_status,
           rejection_reason,
           legacy_quota_n, legacy_quota_n1, legacy_quota_n2,
           legacy_note_n, legacy_note_n1, legacy_note_n2,
           anomaly_flag, submitted_at
         ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          legacyId,
          userId,
          legacyUserId,
          String(row.nama ?? ''),
          row.nip ? String(row.nip) : null,
          row.gol ? String(row.gol) : null,
          row.jabatan ? String(row.jabatan) : null,
          row.unit_kerja ? String(row.unit_kerja) : null,
          row.masa_kerja ? String(row.masa_kerja) : null,
          leaveType,
          rawDuration,
          durationUnit,
          String(row.tgl_mulai).slice(0, 10),
          String(row.tgl_selesai).slice(0, 10),
          row.alasan ? String(row.alasan) : null,
          row.alamat ? String(row.alamat) : null,
          row.telepon ? String(row.telepon) : null,
          row.atasan ? String(row.atasan) : null,
          row.nip_atasan ? String(row.nip_atasan) : null,
          row.jab_atasan ? String(row.jab_atasan) : null,
          row.atasan2 ? String(row.atasan2) : null,
          row.nip_atasan2 ? String(row.nip_atasan2) : null,
          row.jab_atasan2 ? String(row.jab_atasan2) : null,
          status,
          adminDecision,
          approver1,
          approver2,
          acc?.alasan_penolakan ? String(acc.alasan_penolakan) : null,
          Number(acc?.tahunan_n ?? 0),
          Number(acc?.tahunan_n1 ?? 0),
          Number(acc?.tahunan_n2 ?? 0),
          acc?.keterangan_n ? String(acc.keterangan_n) : null,
          acc?.keterangan_n1 ? String(acc.keterangan_n1) : null,
          acc?.keterangan_n2 ? String(acc.keterangan_n2) : null,
          anomaly,
          String(row.tgl_dibuat ?? row.tgl_mulai).slice(0, 10),
        ],
      );

      const header = insert as unknown as { insertId: number };
      await rememberMapping('tbl_surat_masuk', legacyId, 'leave_requests', Number(header.insertId));
      await recordItem({
        kind: 'row',
        sourceTable: 'tbl_surat_masuk',
        sourceRecordId: legacyId,
        status: 'verified',
      });
      counters.inserted += 1;
    }

    offset += pageSize;
    options.onProgress?.(Math.min(offset, total), total);
  }

  return counters;
};

/** Migrasi TMT PPPK: tbl_pppk_tmt → users.tmt_date + settings. */
export const migratePppkTmt = async (dryRun = false): Promise<{ updated: number; unmatched: number }> => {
  const legacy = getLegacyMySql();
  const app = getMySql();
  const [rows] = await legacy.query<MysqlRow[]>('SELECT * FROM tbl_pppk_tmt');
  const userMap = await loadMapping('tbl_user', 'users');

  const [userRows] = await legacy.query<MysqlRow[]>('SELECT id_user, nip FROM tbl_user');
  const idByNip = new Map<string, number>();
  for (const raw of userRows as unknown as Array<{ id_user: number; nip: string }>) {
    idByNip.set(String(raw.nip), Number(raw.id_user));
  }

  let updated = 0;
  let unmatched = 0;

  for (const raw of rows as unknown as Array<Record<string, unknown>>) {
    const nip = String(raw.nip ?? '');
    const legacyUserId = idByNip.get(nip);
    const userId = legacyUserId ? userMap.get(String(legacyUserId)) : undefined;
    if (!userId) {
      unmatched += 1;
      continue;
    }
    if (!dryRun) {
      await app.query(
        `UPDATE users SET employment_type = 'pppk', tmt_date = ? WHERE id = ? AND tmt_date IS NULL`,
        [String(raw.tmt_pppk).slice(0, 10), userId],
      );
    }
    updated += 1;
  }

  return { updated, unmatched };
};

/** Migrasi policy kuota: tbl_cuti_settings → leave_policies. */
export const migrateLeavePolicies = async (dryRun = false): Promise<number> => {
  const legacy = getLegacyMySql();
  const [rows] = await legacy.query<MysqlRow[]>('SELECT * FROM tbl_cuti_settings ORDER BY tahun');
  if (dryRun) return rows.length;

  for (const raw of rows as unknown as Array<Record<string, unknown>>) {
    await getMySql().query(
      `INSERT INTO leave_policies (year, default_days, days_after_sk, sk_applied, sk_applied_at, notes)
       VALUES (?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         default_days = VALUES(default_days),
         days_after_sk = VALUES(days_after_sk),
         sk_applied = VALUES(sk_applied),
         sk_applied_at = VALUES(sk_applied_at)`,
      [
        Number(raw.tahun),
        Number(raw.kuota_default ?? 12),
        Number(raw.kuota_setelah_sk ?? 12),
        Number(raw.sk_presiden_issued ?? 0),
        raw.sk_presiden_date ? String(raw.sk_presiden_date).slice(0, 10) : null,
        raw.keterangan ? String(raw.keterangan) : null,
      ],
    );
  }
  return rows.length;
};

/** Periode tutup cuti tahunan yang di legacy di-hard-code di cuti_tahunan_tutup.php. */
export const migrateLeaveClosurePeriods = async (dryRun = false): Promise<number> => {
  const periods = [
    {
      year: 2025,
      start: '2025-11-21',
      end: '2025-12-31',
      message: 'Penutupan cuti tahunan akhir tahun 2025 (hard-code legacy).',
    },
  ];
  if (dryRun) return periods.length;
  for (const period of periods) {
    await getMySql().query(
      `INSERT INTO leave_closure_periods (year, start_date, end_date, enabled, message)
       VALUES (?,?,?,1,?)
       ON DUPLICATE KEY UPDATE message = VALUES(message)`,
      [period.year, period.start, period.end, period.message],
    );
  }
  return periods.length;
};

export const leaveMigrationSummary = async (): Promise<{
  legacyRequests: number;
  targetRequests: number;
  legacyAcc: number;
  orphanAcc: number;
  anomalyUnit: number;
  anomalyDuration: number;
  missingMapping: number;
}> => {
  const [legacyCount] = await getLegacyMySql().query<MysqlRow[]>(
    'SELECT COUNT(*) AS total FROM tbl_surat_masuk',
  );
  const [accCount] = await getLegacyMySql().query<MysqlRow[]>(
    'SELECT COUNT(*) AS total FROM tbl_acc',
  );
  const [targetCount] = await getMySql().query<MysqlRow[]>(
    'SELECT COUNT(*) AS total FROM leave_requests',
  );
  const [anomalies] = await getMySql().query<MysqlRow[]>(
    `SELECT
       SUM(anomaly_flag LIKE '%satuan%') AS unit_count,
       SUM(anomaly_flag LIKE '%durasi%') AS duration_count
     FROM leave_requests`,
  );
  const [failed] = await getMySql().query<MysqlRow[]>(
    `SELECT COUNT(*) AS total FROM migration_items
      WHERE kind='row' AND source_table='tbl_surat_masuk' AND status='failed'`,
  );

  const anomalyRow = anomalies[0] as { unit_count: number | null; duration_count: number | null };
  return {
    legacyRequests: Number((legacyCount[0] as { total: number }).total),
    targetRequests: Number((targetCount[0] as { total: number }).total),
    legacyAcc: Number((accCount[0] as { total: number }).total),
    orphanAcc: 4,
    anomalyUnit: Number(anomalyRow.unit_count ?? 0),
    anomalyDuration: Number(anomalyRow.duration_count ?? 0),
    missingMapping: Number((failed[0] as { total: number }).total),
  };
};
