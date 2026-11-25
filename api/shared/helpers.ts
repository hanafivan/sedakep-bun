import type { Context } from 'hono';
import type { AuthUser } from '../middleware/bearerAuth';
import { canSeeAll } from '../middleware/roleGuard';

/**
 * Helper bersama untuk handler, domain, tanggal, paginasi, otorisasi, dan unggahan berkas.
 */

// ---------------------------------------------------------------------------
// Konteks auth & otorisasi kepemilikan
// ---------------------------------------------------------------------------

/** Ambil user yang sedang login dari context Hono. */
export const actor = (c: Context | { get: (key: 'user') => AuthUser }): AuthUser =>
  (c as Context).get('user');

/** Cek apakah user boleh melihat data lintas pegawai (admin, verifikator, atasan). */
export const seesAll = (user: Pick<AuthUser, 'role'>): boolean => canSeeAll(user.role);

const resolveOwnerId = (target: { user_id: number } | number | string): number =>
  typeof target === 'object' && target !== null ? Number(target.user_id) : Number(target);

/** Pegawai hanya boleh melihat miliknya sendiri; admin/verifikator/atasan boleh melihat semua. */
export const canViewByOwnerOrStaff = (
  user: { id: number | string; role: string },
  record: { user_id: number } | number | string,
): boolean => canSeeAll(user.role) || Number(user.id) === resolveOwnerId(record);

/** Hanya admin atau pemilik data yang boleh mengubah/menghapus record. */
export const canEditByOwnerOrAdmin = (
  user: { id: number | string; role: string },
  record: { user_id: number } | number | string,
): boolean => user.role === 'admin' || Number(user.id) === resolveOwnerId(record);

/** Turunkan status persetujuan 3 tingkat (admin → atasan 1 → atasan 2). */
export const deriveThreeLevelStatus = (
  adminDecision: string,
  approver1: string,
  approver2: string,
): 'in_review' | 'approved' | 'rejected' | 'cancelled' => {
  if (adminDecision === 'cancelled' || approver1 === 'cancelled' || approver2 === 'cancelled') {
    return 'cancelled';
  }
  if (adminDecision === 'rejected' || approver1 === 'rejected' || approver2 === 'rejected') {
    return 'rejected';
  }
  if (adminDecision === 'accepted' && approver1 === 'accepted' && approver2 === 'accepted') {
    return 'approved';
  }
  return 'in_review';
};

// ---------------------------------------------------------------------------
// Unggahan berkas (multipart File → buffer upload)
// ---------------------------------------------------------------------------

export type UploadPayload = {
  buffer: Buffer;
  filename: string;
  mimeType: string | null;
};

/** Konversi objek File multipart menjadi payload standar unggahan dokumen. */
export const toUpload = async (file: File): Promise<UploadPayload> => ({
  buffer: Buffer.from(await file.arrayBuffer()),
  filename: file.name || 'berkas',
  mimeType: file.type || null,
});

// ---------------------------------------------------------------------------
// Paginasi standar
// ---------------------------------------------------------------------------

/** Normalisasi parameter halaman & batas item (default 25, maks 200). */
export const normalizePagination = (
  filterOrPage?: number | { page?: number; perPage?: number },
  perPageParam?: number,
) => {
  let page: number | undefined;
  let perPage: number | undefined;
  if (typeof filterOrPage === 'object' && filterOrPage !== null) {
    page = filterOrPage.page;
    perPage = filterOrPage.perPage;
  } else {
    page = filterOrPage;
    perPage = perPageParam;
  }
  const safePerPage = Math.min(Math.max(perPage ?? 25, 1), 200);
  const safePage = Math.max(page ?? 1, 1);
  return {
    page: safePage,
    perPage: safePerPage,
    limit: safePerPage,
    offset: (safePage - 1) * safePerPage,
  };
};

/** Bentuk respons paginasi standar API. */
export const paginatedResult = <T>(
  items: T[],
  total: number,
  page: number,
  perPage: number,
) => ({
  items,
  total,
  page,
  per_page: perPage,
  total_pages: Math.ceil(total / perPage),
});

// ---------------------------------------------------------------------------
// Tanggal & waktu
// ---------------------------------------------------------------------------

/** Tahun kalender berjalan. */
export const yearNow = (): number => new Date().getFullYear();

/** Ekstrak tahun numerik dari tanggal ISO / Date. */
export const yearOf = (value: string | Date): number => Number(String(value).slice(0, 4));

/** Timestamp MySQL format `YYYY-MM-DD HH:MM:SS`. */
export const nowStamp = (): string =>
  new Date().toISOString().slice(0, 19).replace('T', ' ');

/** Tanggal hari ini format `YYYY-MM-DD`. */
export const today = (): string => new Date().toISOString().slice(0, 10);

/**
 * Normalisasi DATE/Date/ISO menjadi string `YYYY-MM-DD`.
 * Mengembalikan `''` untuk nilai kosong atau tanggal tidak valid agar kalkulasi tahun tidak menghasilkan NaN.
 */
export const toDateOnly = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value ?? '');
  const match = text.match(/^\d{4}-\d{2}-\d{2}/);
  if (match) return match[0];
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return '';
};

const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

/**
 * Format tanggal ke bahasa Indonesia, misal `15 Januari 2024`.
 * `fallback` default `''` (bisa diisi `'-'` untuk tampilan cetak).
 */
export const formatDateId = (
  value: string | Date | null | undefined,
  fallback = '',
): string => {
  if (!value) return fallback;
  const iso = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
  const parts = iso.split('-');
  if (parts.length !== 3) return String(value);
  const [y, m, d] = parts;
  return `${Number(d)} ${MONTHS_ID[Number(m) - 1] ?? m} ${y}`;
};
