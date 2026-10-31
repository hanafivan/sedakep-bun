#!/usr/bin/env bun
/**
 * Laporan go-live (Fase 14 langkah 4): bandingkan jumlah baris sumber legacy vs
 * target, plus catatan saldo kuota. Menulis artifact:
 *
 *   docs/go-live-report.csv
 *   docs/go-live-report.html
 *
 * Read-only terhadap kedua database.
 */
import { closeMySql, mysqlQuery } from '../api/db/mysql';
import { closeLegacyMySql, getLegacyMySql } from '../api/db/legacy-mysql';
import type { RowDataPacket } from 'mysql2/promise';

type Mapping = {
  module: string;
  sourceTable: string;
  targetTable: string;
  /** Filter target (mis. service_type) bila tabel target generik. */
  targetFilter?: { column: string; value: string };
};

const MAPPINGS: Mapping[] = [
  { module: 'Users', sourceTable: 'tbl_user', targetTable: 'users' },
  { module: 'Cuti (permohonan)', sourceTable: 'tbl_surat_masuk', targetTable: 'leave_requests' },
  { module: 'Surat keterangan cuti', sourceTable: 'tbl_suket', targetTable: 'leave_letters' },
  { module: 'Surat tugas', sourceTable: 'hlm_surtug', targetTable: 'assignment_letters' },
  { module: 'Surat tugas - pegawai', sourceTable: 'hlm_surtug_peg', targetTable: 'assignment_members' },
  { module: 'Surat tugas - keterangan', sourceTable: 'hlm_surtug_ket', targetTable: 'assignment_notes' },
  { module: 'Surat tugas - tembusan', sourceTable: 'hlm_surtug_tembus', targetTable: 'assignment_copies' },
  { module: 'Alibi', sourceTable: 'hlm_alibi', targetTable: 'alibi_requests' },
  { module: 'Agenda', sourceTable: 'hlm_agenda', targetTable: 'agendas' },
  { module: 'Surat masuk', sourceTable: 'hlm_edispo', targetTable: 'incoming_letters' },
  { module: 'Disposisi', sourceTable: 'hlm_edispo_disposisi', targetTable: 'dispositions' },
  { module: 'Klasifikasi surat', sourceTable: 'hlm_edispo_klasifikasi', targetTable: 'letter_classifications' },
  { module: 'Pensiun', sourceTable: 'hlm_pens_reg_usul', targetTable: 'service_requests', targetFilter: { column: 'service_type', value: 'pensiun' } },
  { module: 'Gelar', sourceTable: 'hlm_gelar', targetTable: 'service_requests', targetFilter: { column: 'service_type', value: 'gelar' } },
  { module: 'Karpeg', sourceTable: 'hlm_karpeg', targetTable: 'service_requests', targetFilter: { column: 'service_type', value: 'karpeg' } },
  { module: 'Karis/Karsu', sourceTable: 'hlm_karisu', targetTable: 'service_requests', targetFilter: { column: 'service_type', value: 'karisu' } },
  { module: 'BPJS', sourceTable: 'hlm_bpjs', targetTable: 'service_requests', targetFilter: { column: 'service_type', value: 'bpjs' } },
  { module: 'Taspen', sourceTable: 'hlm_taspen', targetTable: 'service_requests', targetFilter: { column: 'service_type', value: 'taspen' } },
  { module: 'Satya Lencana', sourceTable: 'hlm_satlen', targetTable: 'service_requests', targetFilter: { column: 'service_type', value: 'satlen' } },
  { module: 'Izin belajar', sourceTable: 'hlm_ibel', targetTable: 'service_requests', targetFilter: { column: 'service_type', value: 'ibel' } },
  { module: 'Tugas belajar', sourceTable: 'tugas_belajar', targetTable: 'service_requests', targetFilter: { column: 'service_type', value: 'tugas_belajar' } },
  { module: 'Pangkat', sourceTable: 'hlm_pangkat', targetTable: 'service_requests', targetFilter: { column: 'service_type', value: 'pangkat' } },
];

type Result = {
  module: string;
  sourceTable: string;
  targetTable: string;
  source: number | null;
  target: number;
  note: string;
};

const countLegacy = async (table: string): Promise<number | null> => {
  try {
    const [rows] = await getLegacyMySql().query<RowDataPacket[]>(
      `SELECT COUNT(*) AS c FROM \`${table}\``,
    );
    return Number((rows[0] as { c: number }).c);
  } catch {
    return null;
  }
};

const main = async (): Promise<void> => {
  const results: Result[] = [];
  for (const mapping of MAPPINGS) {
    const source = await countLegacy(mapping.sourceTable);
    const params: unknown[] = [];
    let sql = `SELECT COUNT(*) AS c FROM \`${mapping.targetTable}\``;
    if (mapping.targetFilter) {
      sql += ` WHERE \`${mapping.targetFilter.column}\` = ?`;
      params.push(mapping.targetFilter.value);
    }
    const targetRows = await mysqlQuery<Array<RowDataPacket & { c: number }>>(sql, params);
    const target = Number(targetRows[0]?.c ?? 0);

    let note = '';
    if (source === null) note = 'tabel sumber tidak ada';
    else if (source === target) note = 'cocok';
    else if (target < source) note = `kurang ${source - target} (migrasi belum / sebagian)`;
    else note = `lebih ${target - source} (perlu penjelasan)`;

    results.push({
      module: mapping.module,
      sourceTable: mapping.sourceTable,
      targetTable: mapping.targetTable,
      source,
      target,
      note,
    });
  }

  const stamp = new Date().toISOString();
  const header = ['Modul', 'Tabel sumber', 'Tabel target', 'Sumber', 'Target', 'Catatan'];
  const csv = [
    `# Laporan go-live ${stamp}`,
    header.join(','),
    ...results.map((r) =>
      [r.module, r.sourceTable, r.targetTable, r.source ?? 'n/a', r.target, r.note]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    ),
  ].join('\n');
  await Bun.write('docs/go-live-report.csv', csv);

  const rowsHtml = results
    .map(
      (r) =>
        `<tr><td>${r.module}</td><td>${r.sourceTable}</td><td>${r.targetTable}</td><td style="text-align:right">${r.source ?? 'n/a'}</td><td style="text-align:right">${r.target}</td><td>${r.note}</td></tr>`,
    )
    .join('\n');
  const html = `<!doctype html>
<meta charset="utf-8">
<title>Laporan go-live Sedakep</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 32px; color: #1a1a2e; }
  h1 { font-size: 20px; } .stamp { color: #667; font-size: 13px; }
  table { border-collapse: collapse; width: 100%; margin-top: 16px; font-size: 13px; }
  th, td { border: 1px solid #ccd; padding: 6px 10px; text-align: left; }
  th { background: #f0f2fb; }
  .ok { color: #1a7f4b; } .warn { color: #a56a00; }
</style>
<h1>Laporan go-live Sedakep</h1>
<p class="stamp">Dibuat ${stamp}</p>
<table>
  <thead><tr><th>Modul</th><th>Tabel sumber</th><th>Tabel target</th><th>Sumber</th><th>Target</th><th>Catatan</th></tr></thead>
  <tbody>
${rowsHtml}
  </tbody>
</table>
<p class="stamp">Catatan: migrasi isi data (Fase 9/10) saat ini ditunda; angka "kurang" adalah
kondisi yang diharapkan sampai keputusan migrasi diambil. Lihat docs/cutover-runbook.md.</p>
`;
  await Bun.write('docs/go-live-report.html', html);

  console.log(`Laporan go-live ${stamp}`);
  for (const r of results) {
    const flag = r.note === 'cocok' ? 'OK  ' : 'CEK ';
    console.log(`${flag} ${r.module.padEnd(24)} sumber=${String(r.source ?? 'n/a').padStart(6)} target=${String(r.target).padStart(6)}  ${r.note}`);
  }
  console.log('\nArtifact: docs/go-live-report.csv, docs/go-live-report.html');
};

await main();
await closeMySql();
await closeLegacyMySql();
