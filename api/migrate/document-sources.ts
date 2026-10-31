import { createHash } from 'node:crypto';
import { join } from 'node:path';

/**
 * Daftar kolom file legacy yang harus dipindah ke MinIO.
 *
 * Hasil audit `information_schema` pada `ptsp_sedakep`: 20 kolom file tersebar
 * di 19 tabel. Dua tabel basi (`hlm_pangkat_sk`, `tbl_skmi_skpp`) kosong tapi
 * tetap didaftarkan supaya jumlahnya konsisten dan aman kalau data bertambah.
 *
 * `target` menerangkan ke mana dokumen harus ditautkan:
 *  - `leave_request`   → leave_requests.legacy_id = sourceRecordId, label = sourceColumn
 *  - `service_request` → service_requests (legacy_table, legacy_id), label = sourceColumn
 *  - `incoming_letter` → incoming_letters.legacy_id
 *  - `assignment`      → assignment_letters.legacy_id
 *  - `alibi`           → alibi_requests.legacy_id
 *  - `unmapped`        → modulnya belum diport; dokumen tetap dipindah supaya
 *                        tidak hilang, hanya belum ada yang menautkan
 */

export type DocumentTarget =
  | 'leave_request'
  | 'leave_letter'
  | 'service_request'
  | 'incoming_letter'
  | 'assignment'
  | 'alibi'
  | 'unmapped';

export type DocumentSource = {
  /** Nama tabel legacy. */
  table: string;
  /** Kolom yang menyimpan nama file. */
  column: string;
  /** Direktori di dalam root aplikasi legacy. */
  directory: string;
  target: DocumentTarget;
  /** Label entitas target (untuk `document_links.entity_table`). */
  entityTable: string;
  /** Modul, dipakai di object key. */
  module: string;
};

/** Slug direktori → modul, supaya object key tetap stabil. */
const APP_ROOT = process.env.LEGACY_APP_ROOT
  ?? '/Applications/XAMPP/htdocs/sedakep-ptsp-kemenag-sleman';

export const legacyAppRoot = (): string => APP_ROOT;

export const legacyFileRoot = (directory: string): string => join(APP_ROOT, directory);

export const DOCUMENT_SOURCES: DocumentSource[] = [
  // ---- cuti ----
  {
    table: 'tbl_surat_masuk',
    column: 'file',
    directory: 'upload/surat_masuk',
    target: 'leave_request',
    entityTable: 'leave_requests',
    module: 'leave',
  },
  // ---- surat masuk umum / disposisi ----
  {
    table: 'hlm_edispo',
    column: 'file',
    directory: 'disposisi/upload/surat_masuk',
    target: 'incoming_letter',
    entityTable: 'incoming_letters',
    module: 'disposisi',
  },
  // ---- surat tugas ----
  {
    table: 'hlm_surtug',
    column: 'file_sk',
    directory: 'surattugas/upload',
    target: 'assignment',
    entityTable: 'assignment_letters',
    module: 'surattugas',
  },
  // ---- alibi ----
  {
    table: 'hlm_alibi_acc',
    column: 'file_alibi',
    directory: 'alibi/upload_alb',
    target: 'alibi',
    entityTable: 'alibi_requests',
    module: 'alibi',
  },
  // ---- surat keterangan ----
  {
    table: 'tbl_suket',
    column: 'file_sk',
    directory: 'upload/surat_keterangan',
    target: 'leave_letter',
    entityTable: 'leave_letters',
    module: 'leave',
  },
  {
    table: 'tbl_suketmad',
    column: 'file_sk',
    directory: 'ijinbelajar/upload',
    target: 'leave_letter',
    entityTable: 'leave_letters',
    module: 'leave',
  },
  // ---- layanan kepegawaian ----
  {
    table: 'hlm_gelar_acc',
    column: 'file_sk',
    directory: 'gelar/upload',
    target: 'service_request',
    entityTable: 'service_requests',
    module: 'gelar',
  },
  {
    table: 'hlm_ibel_acc',
    column: 'file_sk',
    directory: 'ijinbelajar/upload',
    target: 'service_request',
    entityTable: 'service_requests',
    module: 'ijinbelajar',
  },
  {
    table: 'hlm_karpeg_acc',
    column: 'file_sk',
    directory: 'karpeg/upload',
    target: 'service_request',
    entityTable: 'service_requests',
    module: 'karpeg',
  },
  {
    table: 'hlm_karisu_acc',
    column: 'file_sk',
    directory: 'kariskarsu/upload',
    target: 'service_request',
    entityTable: 'service_requests',
    module: 'kariskarsu',
  },
  {
    table: 'hlm_bpjs_acc',
    column: 'file_sk',
    directory: 'bpjs/upload',
    target: 'service_request',
    entityTable: 'service_requests',
    module: 'bpjs',
  },
  {
    table: 'hlm_taspen_acc',
    column: 'file_sk',
    directory: 'taspen/upload',
    target: 'service_request',
    entityTable: 'service_requests',
    module: 'taspen',
  },
  {
    table: 'hlm_pangkat_sk',
    column: 'file_sk',
    directory: 'pangkat/upload',
    target: 'service_request',
    entityTable: 'service_requests',
    module: 'pangkat',
  },
  {
    table: 'tbl_pmk',
    column: 'file_pmk',
    directory: 'pmk/upload',
    target: 'service_request',
    entityTable: 'service_requests',
    module: 'pmk',
  },
  {
    table: 'tbl_skmi_skpp',
    column: 'file_skmi_skpp',
    directory: 'skmi_skpp/upload',
    target: 'service_request',
    entityTable: 'service_requests',
    module: 'skmi_skpp',
  },
  // ---- pensiun ----
  {
    table: 'hlm_pens_reg_usul',
    column: 'foto',
    directory: 'pensiun/upload/usul',
    target: 'service_request',
    entityTable: 'service_requests',
    module: 'pensiun',
  },
  {
    table: 'hlm_pens_reg_acc',
    column: 'cek_foto',
    directory: 'pensiun/upload',
    target: 'service_request',
    entityTable: 'service_requests',
    module: 'pensiun',
  },
  {
    table: 'hlm_pens_reg_suket',
    column: 'file_dpcp',
    directory: 'pensiun/upload',
    target: 'service_request',
    entityTable: 'service_requests',
    module: 'pensiun',
  },
  {
    table: 'hlm_pens_reg_suket',
    column: 'file_sk',
    directory: 'pensiun/upload',
    target: 'service_request',
    entityTable: 'service_requests',
    module: 'pensiun',
  },
  {
    table: 'hlm_pens_reg_suket',
    column: 'file_sp',
    directory: 'pensiun/upload',
    target: 'service_request',
    entityTable: 'service_requests',
    module: 'pensiun',
  },
];

/**
 * Object key deterministik.
 *
 * Nama file legacy TIDAK unik antar tabel (dibuat dengan `rand(1,10000)`), jadi
 * object key wajib memuat tabel + id baris. Bentuknya sengaja sama dengan
 * konvensi di plan:
 *   legacy/{module}/{table}/{recordId}/{column}/{filename}
 */
export const objectKeyFor = (source: {
  table: string;
  column: string;
  recordId: string;
  filename: string;
  module: string;
}): string => {
  const safeName = sanitizeFilename(source.filename);
  return `legacy/${source.module}/${source.table}/${source.recordId}/${source.column}/${safeName}`;
};

/** Buang komponen path dan karakter yang bikin masalah di object key. */
export const sanitizeFilename = (filename: string): string => {
  const base = filename.split(/[\\/]/).pop() ?? filename;
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[<>:"|?*]/g, '_')
    .trim();
  return cleaned.length > 0 ? cleaned.slice(0, 200) : 'file';
};

/**
 * Fingerprint gabungan untuk deteksi perubahan isi.
 *
 * Kolom `migration_items.fingerprint` bertipe CHAR(64), jadi gabungan komponen
 * di-hash SHA-256 dulu — bukan disimpan sebagai string panjang.
 */
export const fingerprintOf = (parts: {
  sourceTable: string;
  sourceRecordId: string;
  sourceColumn: string;
  legacyPath: string;
  fileSize: number;
  sha256: string;
}): string =>
  createHash('sha256')
    .update(
      [
        parts.sourceTable,
        parts.sourceRecordId,
        parts.sourceColumn,
        parts.legacyPath,
        parts.fileSize,
        parts.sha256,
      ].join('|'),
      'utf8',
    )
    .digest('hex');
