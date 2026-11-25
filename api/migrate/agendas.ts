import { getMySql, type MysqlRow } from '../db/mysql';
import { getLegacyMySql } from '../db/legacy-mysql';
import {
  alreadyMigrated,
  recordItem,
  rememberMapping,
} from './legacy-map';

export type AgendaMigrationCounters = {
  read: number;
  inserted: number;
  skipped: number;
  unmappedUser: number;
};

export const migrateAgendas = async (options: {
  dryRun?: boolean;
  batchLimit?: number;
  onProgress?: (done: number, total: number) => void;
} = {}): Promise<AgendaMigrationCounters> => {
  const dryRun = options.dryRun ?? false;
  const limit = options.batchLimit ?? 0;
  const legacy = getLegacyMySql();
  const app = getMySql();

  const counters: AgendaMigrationCounters = {
    read: 0,
    inserted: 0,
    skipped: 0,
    unmappedUser: 0,
  };

  const [userRows] = await app.query<MysqlRow[]>(
    `SELECT legacy_pk, target_id FROM legacy_mappings WHERE legacy_table = 'tbl_user' AND target_table = 'users'`,
  );
  const userMap = new Map<number, number>();
  for (const row of userRows as unknown as Array<{ legacy_pk: string; target_id: number }>) {
    userMap.set(Number(row.legacy_pk), Number(row.target_id));
  }

  const [firstAdmin] = await app.query<MysqlRow[]>(
    "SELECT id FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1",
  );
  const fallbackUserId = Number((firstAdmin[0] as { id?: number } | undefined)?.id ?? 1);

  const [totalRows] = await legacy.query<MysqlRow[]>('SELECT COUNT(*) AS total FROM hlm_agenda');
  const total = Number((totalRows[0] as { total: number }).total);

  const pageSize = 500;
  let offset = 0;

  while (offset < total) {
    const [batch] = await legacy.query<MysqlRow[]>(
      'SELECT * FROM hlm_agenda ORDER BY id_agenda ASC LIMIT ? OFFSET ?',
      [pageSize, offset],
    );
    const rows = batch as unknown as MysqlRow[];
    if (rows.length === 0) break;

    for (const raw of rows) {
      const row = raw as Record<string, unknown>;
      counters.read += 1;
      const legacyId = String(row.id_agenda);

      if (limit > 0 && counters.inserted >= limit) return counters;

      if (!dryRun && (await alreadyMigrated('hlm_agenda', legacyId))) {
        counters.skipped += 1;
        continue;
      }

      const legacyUserId = Number(row.id_user);
      const userId = userMap.get(legacyUserId) ?? fallbackUserId;
      if (!userMap.has(legacyUserId)) {
        counters.unmappedUser += 1;
      }

      const tglMulai = row.tgl_mulai ? String(row.tgl_mulai).slice(0, 10) : '2026-01-01';
      const jamMulai = row.jam_mulai ? String(row.jam_mulai).slice(0, 5) : '08:00';
      const jamAkhir = row.jam_akhir ? String(row.jam_akhir).slice(0, 5) : '16:00';
      const startAt = `${tglMulai} ${jamMulai}:00`;
      const endAt = `${tglMulai} ${jamAkhir}:00`;

      if (!dryRun) {
        const [insertRes] = await app.query(
          `INSERT INTO agendas (
            legacy_id, user_id, name, nip, title, place, start_at, end_at, report, reported_at, created_at
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?)
          ON DUPLICATE KEY UPDATE title = VALUES(title), updated_at = NOW()`,
          [
            legacyId,
            userId,
            row.nama ? String(row.nama) : null,
            row.nip ? String(row.nip) : null,
            String(row.agenda || '-'),
            row.tempat ? String(row.tempat) : null,
            startAt,
            endAt,
            row.report ? String(row.report) : null,
            row.report ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null,
            row.tgl_dibuat ? String(row.tgl_dibuat) : new Date().toISOString().slice(0, 19).replace('T', ' '),
          ],
        );

        const newId = Number((insertRes as unknown as { insertId: number }).insertId);
        await rememberMapping('hlm_agenda', legacyId, 'agendas', newId);
        await recordItem({
          kind: 'row',
          sourceTable: 'hlm_agenda',
          sourceRecordId: legacyId,
          status: 'verified',
        });
      }

      counters.inserted += 1;
      options.onProgress?.(counters.read, total);
    }

    offset += pageSize;
  }

  return counters;
};

