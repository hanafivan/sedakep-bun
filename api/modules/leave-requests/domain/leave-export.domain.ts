import { findLeaveRequestsForExport } from '../query';
import { toDateOnly } from './quota.domain';

/**
 * Service ekspor permohonan cuti (CSV).
 *
 * Mengikuti legacy: unduhan `.xls` super admin. Memakai CSV, bukan penulis XLS:
 * Excel membuka CSV dengan benar tanpa dependensi tambahan.
 */

const CSV_HEADERS = [
  'No', 'Nama', 'NIP', 'Gol', 'Jabatan', 'Unit Kerja', 'Jenis Cuti', 'Alasan',
  'Lama', 'Satuan', 'Tgl Mulai', 'Tgl Selesai', 'Tgl Dibuat',
  'Status Pengajuan', 'Acc Atasan #1', 'Acc Atasan #2', 'Keterangan SK',
] as const;

const csvCell = (value: unknown): string => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** Label status permohonan seperti yang dibaca admin di legacy. */
const statusLabel = (row: Record<string, unknown>): string => {
  switch (row.status) {
    case 'approved': return 'Diterima';
    case 'rejected': return 'Ditolak';
    case 'cancelled': return 'Dibatalkan';
    default: return 'Belum diperiksa';
  }
};

const decisionLabel = (value: unknown, level: number): string => {
  if (value === 'accepted') return 'Diterima';
  if (value === 'rejected') return 'Ditolak';
  if (value === 'cancelled') return 'Dibatalkan';
  return `Belum Acc #${level}`;
};

/**
 * Keterangan kolom SK, mengikuti kalimat legacy di `transaksi_surat_masuk.php`.
 * Baris yang belum final tidak dihitung "belum ada SK" karena SK baru relevan
 * setelah permohonan diterima.
 */
const skNote = (row: Record<string, unknown>): string => {
  const status = statusLabel(row);
  if (status === 'Belum diperiksa') return 'Menunggu pengajuan diterima';
  if (status === 'Ditolak') {
    return row.rejection_reason ? `Pengajuan ditolak - ${row.rejection_reason}` : 'Pengajuan ditolak';
  }
  if (status === 'Dibatalkan') {
    return row.rejection_reason ? `Pengajuan dibatalkan - ${row.rejection_reason}` : 'Pengajuan dibatalkan';
  }
  const number = String(row.letter_number ?? '').trim();
  if (!number) return 'Belum diberi nomor SK';
  const numberOnly = number.split('/')[0] ?? '';
  const issued = row.letter_issued_at ? toDateOnly(row.letter_issued_at) : '';
  const month = issued ? issued.slice(5, 7) : '';
  const year = issued ? issued.slice(0, 4) : '';
  return `Nomor SK sudah ada, file SK belum diunggah: B-${numberOnly}/Kk.12.04/1/Kp.08.2/${month}/${year}`;
};

/**
 * Ekspor permohonan cuti sebagai CSV (legacy: unduhan `.xls` super admin).
 */
export const exportLeaveRequestsCsv = async (filter: {
  dateFrom?: string;
  dateTo?: string;
  leaveType?: string;
  statuses?: string[];
  letterStatus?: 'with' | 'without';
  search?: string;
  userId?: number;
}): Promise<string> => {
  const rows = await findLeaveRequestsForExport(filter);
  const lines: string[] = [CSV_HEADERS.join(';')];

  rows.forEach((row, index) => {
    lines.push([
      index + 1,
      row.name,
      row.nip,
      row.grade,
      row.position,
      row.organization_name,
      row.leave_type,
      row.reason,
      row.duration,
      row.duration_unit,
      toDateOnly(row.start_date),
      toDateOnly(row.end_date),
      toDateOnly(row.created_at),
      statusLabel(row),
      decisionLabel(row.approver_1_status, 1),
      decisionLabel(row.approver_2_status, 2),
      skNote(row),
    ].map(csvCell).join(';'));
  });

  return `${lines.join('\r\n')}\r\n`;
};

