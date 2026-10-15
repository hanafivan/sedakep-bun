/** Pemformat tampilan — dipakai bersama supaya angka & tanggal konsisten. */

export const formatDate = (value: string | null | undefined): string => {
  if (!value) return '-';
  const iso = String(value).slice(0, 10);
  const [year, month, day] = iso.split('-');
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
};

export const formatBytes = (bytes: number | null | undefined): string => {
  if (bytes === null || bytes === undefined) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const labelStatus: Record<string, string> = {
  submitted: 'Diajukan',
  in_review: 'Diproses',
  approved: 'Disetujui',
  rejected: 'Ditolak',
  cancelled: 'Dibatalkan',
  pending: 'Menunggu',
  accepted: 'Diterima',
};

/**
 * Status permohonan untuk tampilan.
 *
 * `in_review` sengaja TIDAK pernah ditampilkan sebagai "Disetujui" — status
 * ini berarti masih ada tahap approval yang belum selesai.
 */
export const leaveStatusLabel = (status: string): string =>
  labelStatus[status] ?? status;

/** Kelas warna; dipakai CSS, bukan warna inline. */
export const leaveStatusTone = (status: string | null | undefined): string => {
  if (!status) return 'badge muted';
  if (status === 'approved' || status === 'accepted') return 'badge ok';
  if (status === 'rejected') return 'badge bad';
  if (status === 'cancelled') return 'badge muted';
  if (status === 'in_review' || status === 'pending') return 'badge warn';
  return 'badge';
};

export const decisionLabel = (value: string): string => labelStatus[value] ?? value;

export const totalDays = (bucket: { n: number; n1: number; n2: number }): number =>
  bucket.n + bucket.n1 + bucket.n2;
