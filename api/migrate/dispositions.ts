import { getMySql, type MysqlRow } from '../db/mysql';
import { getLegacyMySql } from '../db/legacy-mysql';
import {
  alreadyMigrated,
  recordItem,
  rememberMapping,
} from './legacy-map';

export type DispositionMigrationCounters = {
  classifications: number;
  lettersRead: number;
  lettersInserted: number;
  lettersSkipped: number;
  dispositionsInserted: number;
  finalsInserted: number;
  unmappedUser: number;
};

export const migrateDispositions = async (options: {
  dryRun?: boolean;
  batchLimit?: number;
  onProgress?: (done: number, total: number) => void;
} = {}): Promise<DispositionMigrationCounters> => {
  const dryRun = options.dryRun ?? false;
  const limit = options.batchLimit ?? 0;
  const legacy = getLegacyMySql();
  const app = getMySql();

  const counters: DispositionMigrationCounters = {
    classifications: 0,
    lettersRead: 0,
    lettersInserted: 0,
    lettersSkipped: 0,
    dispositionsInserted: 0,
    finalsInserted: 0,
    unmappedUser: 0,
  };

  // 1. Migrasi Master Klasifikasi Surat (tbl_klasifikasi)
  try {
    const [klasifikasiRows] = await legacy.query<MysqlRow[]>('SELECT * FROM tbl_klasifikasi');
    for (const raw of klasifikasiRows as unknown as Array<Record<string, unknown>>) {
      const legacyId = String(raw.id_klasifikasi);
      const code = String(raw.kode || '').trim();
      const name = String(raw.nama || '').trim();
      const desc = raw.uraian ? String(raw.uraian).trim() : null;
      if (!code) continue;

      if (!dryRun) {
        const [res] = await app.query(
          `INSERT INTO letter_classifications (legacy_id, code, name, description, is_active)
           VALUES (?, ?, ?, ?, 1)
           ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description)`,
          [legacyId, code, name || code, desc],
        );
        const newId = Number((res as unknown as { insertId: number }).insertId);
        if (newId > 0) {
          await rememberMapping('tbl_klasifikasi', legacyId, 'letter_classifications', newId);
        }
      }
      counters.classifications += 1;
    }
  } catch (err) {
    console.warn('Lewati tbl_klasifikasi jika tidak ada:', (err as Error).message);
  }

  // 2. Map User legacy -> target
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

  // 3. Preload child disposisi & finals
  const dispoByLetter = new Map<number, Array<Record<string, unknown>>>();
  try {
    const [dispoRows] = await legacy.query<MysqlRow[]>('SELECT * FROM hlm_edispo_disposisi ORDER BY id_disposisi ASC');
    for (const raw of dispoRows as unknown as Array<Record<string, unknown>>) {
      const idSurat = Number(raw.id_surat);
      if (!dispoByLetter.has(idSurat)) dispoByLetter.set(idSurat, []);
      dispoByLetter.get(idSurat)!.push(raw);
    }
  } catch {}

  const finalByLetter = new Map<number, Array<Record<string, unknown>>>();
  try {
    const [finalRows] = await legacy.query<MysqlRow[]>('SELECT * FROM hlm_edispo_final ORDER BY id_final ASC');
    for (const raw of finalRows as unknown as Array<Record<string, unknown>>) {
      const idSurat = Number(raw.id_surat);
      if (!finalByLetter.has(idSurat)) finalByLetter.set(idSurat, []);
      finalByLetter.get(idSurat)!.push(raw);
    }
  } catch {}

  // 4. Batch migrasi hlm_edispo
  const [totalRows] = await legacy.query<MysqlRow[]>('SELECT COUNT(*) AS total FROM hlm_edispo');
  const total = Number((totalRows[0] as { total: number }).total);

  const pageSize = 500;
  let offset = 0;

  while (offset < total) {
    const [batch] = await legacy.query<MysqlRow[]>(
      'SELECT * FROM hlm_edispo ORDER BY id_surat ASC LIMIT ? OFFSET ?',
      [pageSize, offset],
    );
    const rows = batch as unknown as MysqlRow[];
    if (rows.length === 0) break;

    for (const raw of rows) {
      const row = raw as Record<string, unknown>;
      counters.lettersRead += 1;
      const legacyId = String(row.id_surat);

      if (limit > 0 && counters.lettersInserted >= limit) return counters;

      if (!dryRun && (await alreadyMigrated('hlm_edispo', legacyId))) {
        counters.lettersSkipped += 1;
        continue;
      }

      const legacyUserId = Number(row.id_user);
      const userId = userMap.get(legacyUserId) ?? fallbackUserId;
      if (!userMap.has(legacyUserId)) {
        counters.unmappedUser += 1;
      }

      const hasFinal = (finalByLetter.get(Number(row.id_surat)) ?? []).length > 0;
      const hasDispo = (dispoByLetter.get(Number(row.id_surat)) ?? []).length > 0;
      const status = hasFinal ? 'selesai' : hasDispo ? 'didisposisi' : 'baru';

      let targetLetterId = 0;
      if (!dryRun) {
        const [insertRes] = await app.query(
          `INSERT INTO incoming_letters (
            legacy_id, created_by, owner_name, owner_nip, agenda_number, ticket_number,
            letter_number, origin, content, classification_code, index_code,
            letter_date, received_date, notes, status, created_at
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
          ON DUPLICATE KEY UPDATE status = VALUES(status), updated_at = NOW()`,
          [
            legacyId,
            userId,
            row.nama ? String(row.nama) : null,
            row.nip ? String(row.nip) : null,
            row.no_agenda ? String(row.no_agenda) : null,
            row.no_ticket ? String(row.no_ticket) : null,
            row.no_surat ? String(row.no_surat) : null,
            row.asal_surat ? String(row.asal_surat) : null,
            row.isi ? String(row.isi) : null,
            row.kode ? String(row.kode) : null,
            row.indeks ? String(row.indeks) : null,
            row.tgl_surat ? String(row.tgl_surat).slice(0, 10) : null,
            row.tgl_diterima ? String(row.tgl_diterima).slice(0, 10) : null,
            row.keterangan ? String(row.keterangan) : null,
            status,
            row.tgl_diterima ? String(row.tgl_diterima) : new Date().toISOString().slice(0, 19).replace('T', ' '),
          ],
        );

        targetLetterId = Number((insertRes as unknown as { insertId: number }).insertId);
        await rememberMapping('hlm_edispo', legacyId, 'incoming_letters', targetLetterId);

        // Migrasi relasi disposisi
        const childDispos = dispoByLetter.get(Number(row.id_surat)) ?? [];
        for (let i = 0; i < childDispos.length; i++) {
          const d = childDispos[i];
          if (!d) continue;
          const legacyDispoId = String(d.id_disposisi);
          await app.query(
            `INSERT INTO dispositions (
              legacy_id, incoming_letter_id, target_name, target_nip, instruction, notes, sort_order, status
            ) VALUES (?,?,?,?,?,?,?,?)
            ON DUPLICATE KEY UPDATE instruction = VALUES(instruction)`,
            [
              legacyDispoId,
              targetLetterId,
              d.nama ? String(d.nama) : null,
              d.nip ? String(d.nip) : null,
              d.isi_disposisi ? String(d.isi_disposisi) : null,
              d.catatan ? String(d.catatan) : null,
              i,
              'accepted',
            ],
          );
          counters.dispositionsInserted += 1;
        }

        // Migrasi relasi final
        const childFinals = finalByLetter.get(Number(row.id_surat)) ?? [];
        for (const f of childFinals) {
          const legacyFinalId = String(f.id_final);
          await app.query(
            `INSERT INTO disposition_finals (
              legacy_id, incoming_letter_id, name, nip, instruction
            ) VALUES (?,?,?,?,?)
            ON DUPLICATE KEY UPDATE instruction = VALUES(instruction)`,
            [
              legacyFinalId,
              targetLetterId,
              f.nama ? String(f.nama) : null,
              f.nip ? String(f.nip) : null,
              f.instruksi ? String(f.instruksi) : null,
            ],
          );
          counters.finalsInserted += 1;
        }

        await recordItem({
          kind: 'row',
          sourceTable: 'hlm_edispo',
          sourceRecordId: legacyId,
          status: 'verified',
        });
      }

      counters.lettersInserted += 1;
      options.onProgress?.(counters.lettersRead, total);
    }

    offset += pageSize;
  }

  return counters;
};
