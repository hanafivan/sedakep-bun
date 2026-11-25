import { getMySql, type MysqlRow } from '../db/mysql';
import { getLegacyMySql } from '../db/legacy-mysql';
import {
  alreadyMigrated,
  recordItem,
  rememberMapping,
} from './legacy-map';

/**
 * Migrasi surat tugas: hlm_surtug (+ peg, ket, tembus, acc) → assignment_letters dkk.
 */

export type AssignmentMigrationCounters = {
  read: number;
  inserted: number;
  skipped: number;
  unmappedUser: number;
  members: number;
  notes: number;
  copies: number;
};

export const migrateAssignments = async (options: {
  dryRun?: boolean;
  batchLimit?: number;
  onProgress?: (done: number, total: number) => void;
} = {}): Promise<AssignmentMigrationCounters> => {
  const dryRun = options.dryRun ?? false;
  const limit = options.batchLimit ?? 0;
  const legacy = getLegacyMySql();
  const app = getMySql();

  const counters: AssignmentMigrationCounters = {
    read: 0,
    inserted: 0,
    skipped: 0,
    unmappedUser: 0,
    members: 0,
    notes: 0,
    copies: 0,
  };

  // Peta user legacy -> target
  const [userRows] = await app.query<MysqlRow[]>(
    `SELECT legacy_pk, target_id FROM legacy_mappings WHERE legacy_table = 'tbl_user' AND target_table = 'users'`,
  );
  const userMap = new Map<number, number>();
  for (const row of userRows as unknown as Array<{ legacy_pk: string; target_id: number }>) {
    userMap.set(Number(row.legacy_pk), Number(row.target_id));
  }

  // Fallback admin user jika pembuat draf tidak terpetakan
  const [firstAdmin] = await app.query<MysqlRow[]>(
    "SELECT id FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1",
  );
  const fallbackUserId = Number((firstAdmin[0] as { id?: number } | undefined)?.id ?? 1);

  // Approval mapping dari hlm_surtug_acc
  const [accRows] = await legacy.query<MysqlRow[]>('SELECT * FROM hlm_surtug_acc');
  const accBySurtug = new Map<number, Record<string, unknown>>();
  for (const raw of accRows as unknown as Array<Record<string, unknown>>) {
    accBySurtug.set(Number(raw.id_surtug), raw);
  }

  // Preload child rows dari hlm_surtug_peg, hlm_surtug_ket, hlm_surtug_tembus
  const [pegRows] = await legacy.query<MysqlRow[]>('SELECT * FROM hlm_surtug_peg ORDER BY id_pegawai ASC');
  const pegBySurtug = new Map<number, Array<Record<string, unknown>>>();
  for (const raw of pegRows as unknown as Array<Record<string, unknown>>) {
    const idSurtug = Number(raw.id_surtug);
    if (!pegBySurtug.has(idSurtug)) pegBySurtug.set(idSurtug, []);
    pegBySurtug.get(idSurtug)!.push(raw);
  }

  const [ketRows] = await legacy.query<MysqlRow[]>('SELECT * FROM hlm_surtug_ket ORDER BY id_keterangan ASC');
  const ketBySurtug = new Map<number, Array<Record<string, unknown>>>();
  for (const raw of ketRows as unknown as Array<Record<string, unknown>>) {
    const idSurtug = Number(raw.id_surtug);
    if (!ketBySurtug.has(idSurtug)) ketBySurtug.set(idSurtug, []);
    ketBySurtug.get(idSurtug)!.push(raw);
  }

  const [tembusRows] = await legacy.query<MysqlRow[]>('SELECT * FROM hlm_surtug_tembus ORDER BY id_tembusan ASC');
  const tembusBySurtug = new Map<number, Array<Record<string, unknown>>>();
  for (const raw of tembusRows as unknown as Array<Record<string, unknown>>) {
    const idSurtug = Number(raw.id_surtug);
    if (!tembusBySurtug.has(idSurtug)) tembusBySurtug.set(idSurtug, []);
    tembusBySurtug.get(idSurtug)!.push(raw);
  }

  const [totalRows] = await legacy.query<MysqlRow[]>('SELECT COUNT(*) AS total FROM hlm_surtug');
  const total = Number((totalRows[0] as { total: number }).total);

  const pageSize = 500;
  let offset = 0;

  while (offset < total) {
    const [batch] = await legacy.query<MysqlRow[]>(
      'SELECT * FROM hlm_surtug ORDER BY id_surtug ASC LIMIT ? OFFSET ?',
      [pageSize, offset],
    );
    const rows = batch as unknown as MysqlRow[];
    if (rows.length === 0) break;

    for (const raw of rows) {
      const row = raw as Record<string, unknown>;
      counters.read += 1;
      const legacyId = String(row.id_surtug);

      if (limit > 0 && counters.inserted >= limit) return counters;

      if (!dryRun && (await alreadyMigrated('hlm_surtug', legacyId))) {
        counters.skipped += 1;
        continue;
      }

      const legacyUserId = Number(row.id_user);
      const userId = userMap.get(legacyUserId) ?? fallbackUserId;
      if (!userMap.has(legacyUserId)) {
        counters.unmappedUser += 1;
      }

      const acc = accBySurtug.get(Number(row.id_surtug));
      const accText = String(acc?.acc ?? '');
      const decision = accText === 'Diterima' ? 'accepted' : accText === 'Ditolak' ? 'rejected' : 'pending';
      const status = decision === 'accepted' ? 'approved' : decision === 'rejected' ? 'rejected' : 'submitted';
      const decidedBy = acc?.id_user ? (userMap.get(Number(acc.id_user)) ?? null) : null;
      const decisionNote = acc?.catatan ? String(acc.catatan) : null;

      const startDate = row.tgl_mulai ? String(row.tgl_mulai).slice(0, 10) : null;
      const endDate = row.tgl_selesai ? String(row.tgl_selesai).slice(0, 10) : null;
      const printedAt = row.tgl_cetak ? String(row.tgl_cetak).slice(0, 10) : null;

      if (dryRun) {
        counters.inserted += 1;
        continue;
      }

      const [insert] = await app.query<MysqlRow[]>(
        `INSERT INTO assignment_letters (
           legacy_id, user_id, code, letter_number,
           consideration, legal_basis, content,
           start_date, end_date, day_start, day_end,
           place, time_start, time_end,
           signer_name, signer_position, footnote, printed_at,
           status, decision, decided_by, decision_note, created_at
         ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP`,
        [
          legacyId,
          userId,
          row.kode ? String(row.kode) : null,
          row.no_surat ? String(row.no_surat) : null,
          row.timbang ? String(row.timbang) : null,
          row.dasar ? String(row.dasar) : null,
          row.isi ? String(row.isi) : null,
          startDate,
          endDate,
          row.hari1 ? String(row.hari1) : null,
          row.hari2 ? String(row.hari2) : null,
          row.tempat ? String(row.tempat) : null,
          row.jam_mulai ? String(row.jam_mulai) : null,
          row.jam_akhir ? String(row.jam_akhir) : null,
          row.nama_pejabat ? String(row.nama_pejabat) : null,
          row.pejabat ? String(row.pejabat) : null,
          row.bawah ? String(row.bawah) : null,
          printedAt,
          status,
          decision,
          decidedBy,
          decisionNote,
          row.tgl_dibuat ? new Date(String(row.tgl_dibuat)) : new Date(),
        ],
      );

      const letterId = Number((insert as unknown as { insertId?: number }).insertId);
      if (letterId) {
        await rememberMapping('hlm_surtug', legacyId, 'assignment_letters', letterId);

        // Anggota
        const pegs = pegBySurtug.get(Number(row.id_surtug)) ?? [];
        for (let i = 0; i < pegs.length; i++) {
          const peg = pegs[i];
          if (!peg) continue;
          const pegLegacyId = String(peg.id_pegawai);
          await app.query(
            `INSERT INTO assignment_members (
               legacy_id, letter_id, name, nip, grade, position, organization_name, sort_order
             ) VALUES (?,?,?,?,?,?,?,?)
             ON DUPLICATE KEY UPDATE name = VALUES(name)`,
            [
              pegLegacyId,
              letterId,
              String(peg.nama ?? ''),
              peg.nip ? String(peg.nip) : null,
              peg.golongan ? String(peg.golongan) : null,
              peg.jabatan ? String(peg.jabatan) : null,
              peg.unit_kerja ? String(peg.unit_kerja) : null,
              i + 1,
            ],
          );
          counters.members += 1;
        }

        // Keterangan
        const kets = ketBySurtug.get(Number(row.id_surtug)) ?? [];
        for (let i = 0; i < kets.length; i++) {
          const ket = kets[i];
          if (!ket) continue;
          const ketLegacyId = String(ket.id_keterangan);
          await app.query(
            `INSERT INTO assignment_notes (legacy_id, letter_id, note, sort_order)
             VALUES (?,?,?,?)
             ON DUPLICATE KEY UPDATE note = VALUES(note)`,
            [ketLegacyId, letterId, String(ket.keterangan ?? ''), i + 1],
          );
          counters.notes += 1;
        }

        // Tembusan
        const tembuses = tembusBySurtug.get(Number(row.id_surtug)) ?? [];
        for (let i = 0; i < tembuses.length; i++) {
          const tembus = tembuses[i];
          if (!tembus) continue;
          const tembusLegacyId = String(tembus.id_tembusan);
          await app.query(
            `INSERT INTO assignment_copies (legacy_id, letter_id, copy_to, sort_order)
             VALUES (?,?,?,?)
             ON DUPLICATE KEY UPDATE copy_to = VALUES(copy_to)`,
            [tembusLegacyId, letterId, String(tembus.tembusan ?? ''), i + 1],
          );
          counters.copies += 1;
        }

        await recordItem({
          kind: 'row',
          sourceTable: 'hlm_surtug',
          sourceRecordId: legacyId,
          status: 'verified',
        });
      }

      counters.inserted += 1;
    }

    offset += rows.length;
    options.onProgress?.(offset, total);
  }

  return counters;
};
