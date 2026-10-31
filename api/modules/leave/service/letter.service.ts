import { badRequest, notFound } from '../../../shared/errors';
import {
  deleteLeaveLetter,
  insertAuditLog,
  nextLeaveLetterNumber,
  upsertLeaveLetter,
} from '../command';
import {
  findLeaveLetterById,
  findLeaveLetterByRequest,
  findLeaveLetters,
  findLeaveRequestById,
} from '../query';
import { buildLetterNumber, normalizeLetterNumber } from '../domain/letter-number';
import { uploadDocument, removeDocument } from '../../documents/service';

/**
 * Service surat keterangan cuti.
 *
 * Legacy: `tbl_suket` (nomor + pejabat + file_sk) dan `tbl_suketmad`
 * (hanya file_sk). Di sini keduanya jadi satu tabel `leave_letters` dengan
 * `letter_type`; nomornya urut per jenis per tahun lewat `leave_letter_counters`.
 *
 * Format nomor mengikuti legacy: `{urut}/Kk.12.04/1/Kp.08.2/{bulan}/{tahun}`.
 * Baris hasil migrasi masih menyimpan angka urut mentah, jadi nomor
 * dinormalkan saat dibaca — bukan ditulis ulang ke database.
 */

export type LetterType = 'suket' | 'suket_madrasah';

const yearOf = (value: string): number => Number(String(value).slice(0, 4));

/** Nomor siap tampil/cetak untuk satu baris surat. */
const withDisplayNumber = <T extends { number: string | null; issued_at: string | null }>(letter: T) => ({
  ...letter,
  number: normalizeLetterNumber(letter.number, letter.issued_at),
});

export const listLetters = async (filter: {
  letterType?: string;
  search?: string;
  page?: number;
  perPage?: number;
}) => {
  const perPage = Math.min(Math.max(filter.perPage ?? 25, 1), 200);
  const page = Math.max(filter.page ?? 1, 1);
  const items = await findLeaveLetters({
    letterType: filter.letterType,
    search: filter.search,
    limit: perPage,
    offset: (page - 1) * perPage,
  });
  return { items: items.map(withDisplayNumber), page, per_page: perPage };
};

/** Surat untuk satu permohonan (bisa dua jenis sekaligus). */
export const getLettersForRequest = async (leaveRequestId: number) =>
  (await findLeaveLetterByRequest(leaveRequestId)).map(withDisplayNumber);

/**
 * Terbitkan surat keterangan untuk satu permohonan.
 *
 * Nomor dibuat atomik (satu statement) sehingga dua penerbitan bersamaan
 * tidak mendapat nomor yang sama. Surat hanya masuk akal setelah permohonan
 * final, jadi itu yang divalidasi lebih dulu.
 */
export const issueLetter = async (input: {
  leave_request_id: number;
  letter_type: LetterType;
  number?: string | null;
  issued_at?: string | null;
  official_position?: string | null;
  official_name?: string | null;
  /** Berkas SK yang diunggah (opsional saat terbit, bisa menyusul). */
  attachment?: { buffer: Buffer; filename: string; mimeType?: string | null } | null;
  actorId: number;
}) => {
  const request = await findLeaveRequestById(input.leave_request_id);
  if (!request) throw notFound('Permohonan cuti tidak ditemukan');
  if (request.status !== 'approved') {
    throw badRequest('Surat keterangan hanya untuk permohonan yang sudah disetujui (final)');
  }
  if (request.leave_type !== 'Cuti Tahunan' && input.letter_type === 'suket') {
    // Surat keterangan biasa khusus cuti tahunan; jenis lain pakai format sendiri (Fase 13).
    throw badRequest('Surat keterangan nomor khusus Cuti Tahunan');
  }

  const year = yearOf(String(request.start_date));
  const existing = (await findLeaveLetterByRequest(input.leave_request_id))
    .find((l) => l.letter_type === input.letter_type);

  const issuedAt = input.issued_at ?? new Date().toISOString().slice(0, 10);
  let number = input.number?.trim() || null;
  if (!number) {
    const seq = await nextLeaveLetterNumber(input.letter_type, year);
    number = buildLetterNumber(seq, issuedAt);
  }

  // Unggah berkas dulu (kalau ada), baru catat barisnya — kegagalan unggah
  // tidak meninggalkan baris surat tanpa berkas.
  let documentId: number | null = existing?.document_id ?? null;
  if (input.attachment) {
    const uploaded = await uploadDocument({
      buffer: input.attachment.buffer,
      filename: input.attachment.filename,
      mimeType: input.attachment.mimeType ?? null,
      entityTable: 'leave_requests',
      entityId: input.leave_request_id,
      field: `${input.letter_type}_file`,
      label: input.letter_type === 'suket' ? 'Berkas SK cuti' : 'Berkas SK madrasah',
      actorId: input.actorId,
    });
    documentId = uploaded.id;
  }

  const id = await upsertLeaveLetter({
    leave_request_id: input.leave_request_id,
    letter_type: input.letter_type,
    number,
    issued_at: issuedAt,
    official_position: input.official_position ?? null,
    official_name: input.official_name ?? null,
    document_id: documentId,
    created_by: input.actorId,
  });

  await insertAuditLog({
    actor_id: input.actorId,
    action: `${input.letter_type}_issued`,
    entity_table: 'leave_letters',
    entity_id: id,
    after_data: {
      leave_request_id: input.leave_request_id,
      number,
      document_id: documentId,
    },
  });

  return { id, number, document_id: documentId };
};

/** Simpan/ubah berkas SK untuk surat yang sudah ada. */
export const attachLetterFile = async (input: {
  leave_letter_id: number;
  buffer: Buffer;
  filename: string;
  mimeType?: string | null;
  actorId: number;
}) => {
  const letter = await findLeaveLetterById(input.leave_letter_id);
  if (!letter) throw notFound('Surat keterangan tidak ditemukan');

  const uploaded = await uploadDocument({
    buffer: input.buffer,
    filename: input.filename,
    mimeType: input.mimeType ?? null,
    entityTable: 'leave_requests',
    entityId: letter.leave_request_id,
    field: `${letter.letter_type}_file`,
    label:
      letter.letter_type === 'suket'
        ? 'Berkas SK cuti (unggahan ulang)'
        : 'Berkas SK madrasah (unggahan ulang)',
    actorId: input.actorId,
  });

  // Ganti rujukan berkas lama; objek lama dibuang supaya tidak menumpuk.
  if (letter.document_id && letter.document_id !== uploaded.id) {
    await removeDocument(letter.document_id).catch(() => undefined);
  }

  await upsertLeaveLetter({
    leave_request_id: letter.leave_request_id,
    letter_type: letter.letter_type,
    number: letter.number,
    issued_at: letter.issued_at,
    official_position: letter.official_position,
    official_name: letter.official_name,
    document_id: uploaded.id,
    legacy_id: letter.legacy_id,
    created_by: letter.created_by,
  });

  return { id: letter.id, document_id: uploaded.id };
};

export const revokeLetter = async (
  input: { leave_request_id: number; letter_type: LetterType },
  actorId: number,
) => {
  const letters = await findLeaveLetterByRequest(input.leave_request_id);
  const letter = letters.find((l) => l.letter_type === input.letter_type);
  if (!letter) throw notFound('Surat keterangan tidak ditemukan');

  if (letter.document_id) {
    await removeDocument(letter.document_id).catch(() => undefined);
  }
  await deleteLeaveLetter(input.leave_request_id, input.letter_type);

  await insertAuditLog({
    actor_id: actorId,
    action: `${input.letter_type}_revoked`,
    entity_table: 'leave_letters',
    entity_id: letter.id,
    before_data: { number: letter.number },
  });
};

export const getLetterDetail = async (id: number) => {
  const letter = await findLeaveLetterById(id);
  if (!letter) throw notFound('Surat keterangan tidak ditemukan');
  return letter;
};