import type { AuthUser } from '../../../middleware/bearerAuth';
import { badRequest, forbidden, notFound } from '../../../shared/errors';
import { makeVerifyCode } from '../../../shared/verify';
import {
  deleteAssignmentCopy,
  deleteAssignmentLetter,
  deleteAssignmentMember,
  deleteAssignmentNote,
  insertAssignmentCopy,
  insertAssignmentLetter,
  insertAssignmentMember,
  insertAssignmentNote,
  insertAuditLog,
  markAssignmentCancelled,
  markAssignmentPrinted,
  setAssignmentNumber,
  updateAssignmentCopy,
  updateAssignmentDecision,
  updateAssignmentLetter,
  updateAssignmentMember,
  updateAssignmentNote,
} from '../command';
import {
  countAssignmentLetters,
  findAssignmentCopies,
  findAssignmentCopyById,
  findAssignmentLetterById,
  findAssignmentLetters,
  findAssignmentMembers,
  findAssignmentMemberById,
  findAssignmentNotes,
  findAssignmentNoteById,
  findInstanceProfile,
  findUserIdentityById,
} from '../query';
import type { AssignmentLetterRow } from '../schema/types';

/**
 * Service surat tugas — aturan bisnis + orkestrasi. Tidak ada SQL di file ini.
 *
 * Cerminan legacy:
 * - `kode` + `tgl_cetak` + `no_surat` membentuk tampilan nomor
 *   `B-{no}/Kk.12.04/{kode}/{MM}/{YYYY}` (lihat `surtug.php`, `cetak_surtug.php`).
 * - Nomor hanya boleh diisi setelah surat disetujui (`surtug_input_nomor.php`).
 * - Approval current-state: satu keputusan admin (`Diterima`/`Ditolak`) yang
 *   di legacy disimpan di `hlm_surtug_acc`.
 */

export type AssignmentLetterInput = Partial<{
  user_id: number;
  code: string;
  consideration: string;
  legal_basis: string;
  content: string;
  start_date: string;
  end_date: string;
  day_start: string;
  day_end: string;
  place: string;
  time_start: string;
  time_end: string;
  signer_name: string;
  signer_position: string;
  footnote: string;
}>;

type LetterWithOwner = AssignmentLetterRow & { name?: string; nip?: string | null };

const nowStamp = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const today = () => new Date().toISOString().slice(0, 10);

const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const formatDateId = (value: string | null | undefined): string => {
  if (!value) return '';
  const iso = String(value).slice(0, 10).split('-');
  if (iso.length !== 3) return String(value);
  const [y, m, d] = iso;
  return `${Number(d)} ${MONTHS_ID[Number(m) - 1] ?? m} ${y}`;
};

/** `B-{no_surat}/Kk.12.04/{kode}/{MM}/{YYYY}` — persis pola legacy. */
const formatNumberDisplay = (row: LetterWithOwner): string | null => {
  if (!row.letter_number) return null;
  const stamp = String(row.printed_at ?? row.created_at ?? '');
  const [year, month] = stamp.slice(0, 7).split('-');
  const code = row.code ?? '';
  return `B-${row.letter_number}/Kk.12.04/${code}/${month ?? ''}/${year ?? ''}`;
};

const toPublic = (row: LetterWithOwner) => ({
  id: row.id,
  user_id: row.user_id,
  name: row.name ?? '',
  nip: row.nip ?? null,
  code: row.code,
  letter_number: row.letter_number,
  number_display: formatNumberDisplay(row),
  consideration: row.consideration,
  legal_basis: row.legal_basis,
  content: row.content,
  start_date: row.start_date,
  end_date: row.end_date,
  day_start: row.day_start,
  day_end: row.day_end,
  place: row.place,
  time_start: row.time_start,
  time_end: row.time_end,
  signer_name: row.signer_name,
  signer_position: row.signer_position,
  footnote: row.footnote,
  printed_at: row.printed_at,
  status: row.status,
  decision: row.decision,
  decided_by: row.decided_by,
  decided_at: row.decided_at,
  decision_note: row.decision_note,
  created_at: String(row.created_at),
  updated_at: String(row.updated_at),
});

export const canViewLetter = (actor: AuthUser, letter: { user_id: number }): boolean =>
  actor.role !== 'pegawai' || Number(actor.id) === Number(letter.user_id);

export const canEditLetter = (actor: AuthUser, letter: { user_id: number }): boolean =>
  actor.role === 'admin' || Number(actor.id) === Number(letter.user_id);

const assertCanEdit = (actor: AuthUser, letter: { user_id: number }) => {
  if (!canEditLetter(actor, letter)) throw forbidden('Tidak berhak mengubah surat tugas ini');
};

/** Ambil surat yang boleh diedit: milik sendiri/admin dan belum final. */
const requireEditableLetter = async (
  id: number,
  actor: AuthUser,
): Promise<AssignmentLetterRow> => {
  const letter = await findAssignmentLetterById(id);
  if (!letter) throw notFound('Surat tugas tidak ditemukan');
  assertCanEdit(actor, letter);
  if (letter.status === 'approved' || letter.status === 'cancelled') {
    throw badRequest('Surat yang sudah final atau dibatalkan tidak dapat diubah');
  }
  return letter;
};

export const listAssignmentLetters = async (
  filter: {
    userId?: number;
    status?: string;
    year?: number;
    search?: string;
    page?: number;
    perPage?: number;
  },
) => {
  const perPage = Math.min(Math.max(filter.perPage ?? 25, 1), 200);
  const page = Math.max(filter.page ?? 1, 1);
  const [items, total] = await Promise.all([
    findAssignmentLetters({ ...filter, limit: perPage, offset: (page - 1) * perPage }),
    countAssignmentLetters(filter),
  ]);
  return {
    items: items.map(toPublic),
    total,
    page,
    per_page: perPage,
    total_pages: Math.ceil(total / perPage),
  };
};

export const getAssignmentLetterDetail = async (id: number) => {
  const letter = await findAssignmentLetterById(id);
  if (!letter) throw notFound('Surat tugas tidak ditemukan');

  const [members, notes, copies] = await Promise.all([
    findAssignmentMembers(id),
    findAssignmentNotes(id),
    findAssignmentCopies(id),
  ]);
  const { listByEntity } = await import('../../documents/domain');
  const [documents, instance] = await Promise.all([
    listByEntity('assignment_letters', id),
    findInstanceProfile(),
  ]);

  return {
    ...toPublic(letter),
    members,
    notes,
    copies,
    documents,
    instance,
    verify_code: makeVerifyCode('assignment_letters', id),
  };
};

/** Batalkan surat yang belum disetujui (pemilik atau admin). */
export const cancelAssignmentLetter = async (id: number, actor: AuthUser) => {
  const letter = await findAssignmentLetterById(id);
  if (!letter) throw notFound('Surat tugas tidak ditemukan');
  assertCanEdit(actor, letter);
  if (letter.status === 'cancelled') {
    return { id, status: 'cancelled' as const, repeated: true };
  }
  if (letter.status === 'approved') {
    throw badRequest('Surat yang sudah disetujui tidak dapat dibatalkan');
  }

  await markAssignmentCancelled(id);
  await insertAuditLog({
    actor_id: Number(actor.id),
    action: 'assignment_cancel',
    entity_table: 'assignment_letters',
    entity_id: id,
    before_data: { status: letter.status },
    after_data: { status: 'cancelled' },
  });
  return { id, status: 'cancelled' as const };
};

/** Hasilkan PDF surat tugas + QR verifikasi, simpan ke MinIO lewat documents. */
export const generateAssignmentPdf = async (id: number, actor: AuthUser) => {
  const detail = await getAssignmentLetterDetail(id);
  if (detail.decision !== 'accepted') {
    throw badRequest('PDF hanya untuk surat yang sudah disetujui');
  }
  if (!detail.letter_number) throw badRequest('Isi nomor surat sebelum mencetak PDF');

  const { buildLetterPdf } = await import('../../../shared/pdf');
  const { verifyUrl } = await import('../../../shared/verify');
  const link = verifyUrl('assignment_letters', id);

  const pdf = await buildLetterPdf({
    kop: [
      detail.instance?.name ?? 'KEMENTERIAN AGAMA',
      detail.instance?.address ?? '',
      detail.instance?.website ?? '',
    ].filter((value) => Boolean(value)),
    title: 'SURAT TUGAS',
    subtitle: `NOMOR: ${detail.number_display ?? '-'}`,
    paragraphs: [
      detail.consideration ? `Pertimbangan: ${detail.consideration}` : '',
      detail.legal_basis ? `Dasar: ${detail.legal_basis}` : '',
      'MEMUTUSKAN',
      detail.content ?? '',
    ].filter((value) => Boolean(value)),
    table: {
      headers: ['No', 'Nama', 'NIP', 'Jabatan'],
      rows: detail.members.map((member, index) => [
        String(index + 1),
        member.name + (member.grade ? ` (${member.grade})` : ''),
        member.nip ?? '-',
        member.position ?? '-',
      ]),
    },
    closing: detail.notes.length > 0 ? ['Keterangan:', ...detail.notes.map((n) => `- ${n.note}`)] : [],
    signer: {
      city: detail.place ?? '',
      date: formatDateId(detail.printed_at ?? detail.created_at),
      position: detail.signer_position ?? '',
      name: detail.signer_name ?? '',
    },
    qr: { text: link },
  });

  const { uploadDocument, getDownloadUrl } = await import('../../documents/domain');
  const uploaded = await uploadDocument({
    buffer: Buffer.from(pdf),
    filename: `surat-tugas-${detail.letter_number}.pdf`,
    mimeType: 'application/pdf',
    entityTable: 'assignment_letters',
    entityId: id,
    field: 'pdf',
    label: 'PDF surat tugas',
    actorId: Number(actor.id),
  });
  const download = await getDownloadUrl(uploaded.id);
  await insertAuditLog({
    actor_id: Number(actor.id),
    action: 'assignment_pdf_generate',
    entity_table: 'assignment_letters',
    entity_id: id,
    after_data: { document_id: uploaded.id },
  });
  return { document_id: uploaded.id, url: download.url, verify_url: link };
};

export const createAssignmentLetter = async (input: AssignmentLetterInput, actor: AuthUser) => {
  const userId = input.user_id ?? Number(actor.id);
  if (Number(actor.id) !== userId && actor.role !== 'admin') {
    throw forbidden('Tidak berhak membuat surat tugas untuk pegawai lain');
  }
  const owner = await findUserIdentityById(userId);
  if (!owner) throw badRequest('Pegawai tidak ditemukan');

  const id = await insertAssignmentLetter({
    user_id: userId,
    code: input.code ?? null,
    consideration: input.consideration ?? null,
    legal_basis: input.legal_basis ?? null,
    content: input.content ?? null,
    start_date: input.start_date ?? null,
    end_date: input.end_date ?? null,
    day_start: input.day_start ?? null,
    day_end: input.day_end ?? null,
    place: input.place ?? null,
    time_start: input.time_start ?? null,
    time_end: input.time_end ?? null,
    signer_name: input.signer_name ?? null,
    signer_position: input.signer_position ?? null,
    footnote: input.footnote ?? null,
    status: 'submitted',
    decision: 'pending',
  });

  await insertAuditLog({
    actor_id: Number(actor.id),
    action: 'assignment_letter_create',
    entity_table: 'assignment_letters',
    entity_id: id,
    after_data: { user_id: userId, code: input.code ?? null },
  });

  return { id, status: 'submitted' as const };
};

export const updateAssignmentLetterById = async (
  id: number,
  input: Record<string, unknown>,
  actor: AuthUser,
) => {
  const letter = await requireEditableLetter(id, actor);
  await updateAssignmentLetter(id, input);
  await insertAuditLog({
    actor_id: Number(actor.id),
    action: 'assignment_letter_update',
    entity_table: 'assignment_letters',
    entity_id: id,
    before_data: { code: letter.code, place: letter.place },
    after_data: input,
  });
  return { id };
};

export const removeAssignmentLetter = async (id: number, actor: AuthUser) => {
  const letter = await findAssignmentLetterById(id);
  if (!letter) throw notFound('Surat tugas tidak ditemukan');
  assertCanEdit(actor, letter);
  if (letter.status === 'approved') {
    throw badRequest('Surat yang sudah disetujui tidak dapat dihapus');
  }
  await deleteAssignmentLetter(id);
  await insertAuditLog({
    actor_id: Number(actor.id),
    action: 'assignment_letter_delete',
    entity_table: 'assignment_letters',
    entity_id: id,
    before_data: { code: letter.code, status: letter.status },
  });
};

export const decideAssignmentLetter = async (
  id: number,
  input: { decision: 'accepted' | 'rejected'; note?: string },
  actor: AuthUser,
) => {
  const letter = await findAssignmentLetterById(id);
  if (!letter) throw notFound('Surat tugas tidak ditemukan');
  if (letter.status === 'cancelled') {
    throw badRequest('Surat yang dibatalkan tidak dapat diputus');
  }
  if (letter.decision === input.decision) {
    return { id, status: letter.status, repeated: true };
  }

  const status = input.decision === 'accepted' ? 'approved' : 'rejected';
  await updateAssignmentDecision(id, {
    decision: input.decision,
    status,
    decided_by: Number(actor.id),
    decided_at: nowStamp(),
    decision_note: input.note ?? null,
  });
  await insertAuditLog({
    actor_id: Number(actor.id),
    action: `assignment_${input.decision}`,
    entity_table: 'assignment_letters',
    entity_id: id,
    before_data: { decision: letter.decision, status: letter.status },
    after_data: { decision: input.decision, status, note: input.note ?? null },
  });
  return { id, status };
};

export const setAssignmentLetterNumber = async (
  id: number,
  letterNumber: string,
  actor: AuthUser,
) => {
  const letter = await findAssignmentLetterById(id);
  if (!letter) throw notFound('Surat tugas tidak ditemukan');
  if (letter.decision !== 'accepted') {
    throw badRequest('Nomor surat hanya dapat diisi setelah surat disetujui');
  }

  await setAssignmentNumber(id, letterNumber, today());
  await insertAuditLog({
    actor_id: Number(actor.id),
    action: 'assignment_number_input',
    entity_table: 'assignment_letters',
    entity_id: id,
    before_data: { letter_number: letter.letter_number },
    after_data: { letter_number: letterNumber },
  });

  const updated = await findAssignmentLetterById(id);
  return toPublic(updated!);
};

export const attachAssignmentFile = async (
  id: number,
  file: { buffer: Buffer; filename: string; mimeType?: string | null },
  actor: AuthUser,
) => {
  const letter = await findAssignmentLetterById(id);
  if (!letter) throw notFound('Surat tugas tidak ditemukan');
  if (letter.decision !== 'accepted') {
    throw badRequest('Berkas surat hanya dapat diunggah setelah surat disetujui');
  }

  const { uploadDocument } = await import('../../documents/domain');
  const uploaded = await uploadDocument({
    buffer: file.buffer,
    filename: file.filename,
    mimeType: file.mimeType ?? null,
    entityTable: 'assignment_letters',
    entityId: id,
    field: 'file_sk',
    label: 'Berkas surat tugas',
    actorId: Number(actor.id),
  });

  await markAssignmentPrinted(id, today());
  await insertAuditLog({
    actor_id: Number(actor.id),
    action: 'assignment_file_upload',
    entity_table: 'assignment_letters',
    entity_id: id,
    after_data: { document_id: uploaded.id },
  });

  return { id, document_id: uploaded.id, object_key: uploaded.object_key };
};

// ---------------------------------------------------------------------------
// Anggota
// ---------------------------------------------------------------------------

export const addAssignmentMember = async (
  letterId: number,
  input: {
    name: string;
    nip?: string;
    grade?: string;
    position?: string;
    organization_name?: string;
    sort_order?: number;
  },
  actor: AuthUser,
) => {
  await requireEditableLetter(letterId, actor);
  const id = await insertAssignmentMember({ letter_id: letterId, ...input });
  await insertAuditLog({
    actor_id: Number(actor.id),
    action: 'assignment_member_add',
    entity_table: 'assignment_members',
    entity_id: id,
    after_data: input,
  });
  return { id };
};

export const updateAssignmentMemberById = async (
  letterId: number,
  memberId: number,
  input: Record<string, unknown>,
  actor: AuthUser,
) => {
  await requireEditableLetter(letterId, actor);
  const member = await findAssignmentMemberById(memberId);
  if (!member || member.letter_id !== letterId) throw notFound('Anggota tidak ditemukan');
  await updateAssignmentMember(memberId, input);
  return { id: memberId };
};

export const removeAssignmentMember = async (
  letterId: number,
  memberId: number,
  actor: AuthUser,
) => {
  await requireEditableLetter(letterId, actor);
  const member = await findAssignmentMemberById(memberId);
  if (!member || member.letter_id !== letterId) throw notFound('Anggota tidak ditemukan');
  await deleteAssignmentMember(memberId);
};

// ---------------------------------------------------------------------------
// Keterangan
// ---------------------------------------------------------------------------

export const addAssignmentNote = async (
  letterId: number,
  input: { note: string; sort_order?: number },
  actor: AuthUser,
) => {
  await requireEditableLetter(letterId, actor);
  const id = await insertAssignmentNote({ letter_id: letterId, ...input });
  await insertAuditLog({
    actor_id: Number(actor.id),
    action: 'assignment_note_add',
    entity_table: 'assignment_notes',
    entity_id: id,
    after_data: input,
  });
  return { id };
};

export const updateAssignmentNoteById = async (
  letterId: number,
  noteId: number,
  input: { note?: string; sort_order?: number },
  actor: AuthUser,
) => {
  await requireEditableLetter(letterId, actor);
  const note = await findAssignmentNoteById(noteId);
  if (!note || note.letter_id !== letterId) throw notFound('Keterangan tidak ditemukan');
  await updateAssignmentNote(noteId, input);
  return { id: noteId };
};

export const removeAssignmentNote = async (letterId: number, noteId: number, actor: AuthUser) => {
  await requireEditableLetter(letterId, actor);
  const note = await findAssignmentNoteById(noteId);
  if (!note || note.letter_id !== letterId) throw notFound('Keterangan tidak ditemukan');
  await deleteAssignmentNote(noteId);
};

// ---------------------------------------------------------------------------
// Tembusan
// ---------------------------------------------------------------------------

export const addAssignmentCopy = async (
  letterId: number,
  input: { copy_to: string; sort_order?: number },
  actor: AuthUser,
) => {
  await requireEditableLetter(letterId, actor);
  const id = await insertAssignmentCopy({ letter_id: letterId, ...input });
  await insertAuditLog({
    actor_id: Number(actor.id),
    action: 'assignment_copy_add',
    entity_table: 'assignment_copies',
    entity_id: id,
    after_data: input,
  });
  return { id };
};

export const updateAssignmentCopyById = async (
  letterId: number,
  copyId: number,
  input: { copy_to?: string; sort_order?: number },
  actor: AuthUser,
) => {
  await requireEditableLetter(letterId, actor);
  const copy = await findAssignmentCopyById(copyId);
  if (!copy || copy.letter_id !== letterId) throw notFound('Tembusan tidak ditemukan');
  await updateAssignmentCopy(copyId, input);
  return { id: copyId };
};

export const removeAssignmentCopy = async (letterId: number, copyId: number, actor: AuthUser) => {
  await requireEditableLetter(letterId, actor);
  const copy = await findAssignmentCopyById(copyId);
  if (!copy || copy.letter_id !== letterId) throw notFound('Tembusan tidak ditemukan');
  await deleteAssignmentCopy(copyId);
};
