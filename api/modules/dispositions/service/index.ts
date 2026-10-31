import type { AuthUser } from '../../../middleware/bearerAuth';
import { badRequest, notFound } from '../../../shared/errors';
import { makeVerifyCode } from '../../../shared/verify';
import {
  deleteClassification,
  deleteDisposition,
  deleteDispositionFinal,
  deleteIncomingLetter,
  deleteReference,
  finalizeIncomingLetter as markFinalized,
  insertAuditLog,
  insertClassification,
  insertDisposition,
  insertDispositionFinal,
  insertIncomingLetter,
  insertReference,
  updateClassification,
  updateDisposition,
  updateIncomingLetter,
} from '../command';
import {
  countIncomingLetters,
  findClassificationByCode,
  findClassificationById,
  findClassifications,
  findDispositionById,
  findDispositionFinalById,
  findDispositionFinals,
  findDispositions,
  findIncomingLetterById,
  findIncomingLetters,
  findInstanceProfile,
  findReferenceById,
  findReferences,
} from '../query';
import type { IncomingLetterRow } from '../schema/types';

/**
 * Service disposisi — aturan bisnis + orkestrasi. Tidak ada SQL di file ini.
 *
 * Cerminan legacy `disposisi/*.php`: surat masuk (`hlm_edispo`), disposisi ke
 * pelaksana (`hlm_edispo_disposisi`), baris final (`hlm_edispo_final`),
 * referensi, klasifikasi (`hlm_edispo_klasifikasi`), dan berkas surat/SK.
 */

export type IncomingLetterInput = Partial<{
  owner_name: string;
  owner_nip: string;
  agenda_number: string;
  ticket_number: string;
  letter_number: string;
  origin: string;
  content: string;
  classification_code: string;
  index_code: string;
  letter_date: string;
  received_date: string;
  notes: string;
}>;

const toPublic = (row: IncomingLetterRow & { disposition_count?: number }) => ({
  id: row.id,
  created_by: row.created_by,
  owner_name: row.owner_name,
  owner_nip: row.owner_nip,
  agenda_number: row.agenda_number,
  ticket_number: row.ticket_number,
  letter_number: row.letter_number,
  origin: row.origin,
  content: row.content,
  classification_code: row.classification_code,
  index_code: row.index_code,
  letter_date: row.letter_date,
  received_date: row.received_date,
  notes: row.notes,
  status: row.status,
  finalized_at: row.finalized_at,
  anomaly_flag: row.anomaly_flag,
  disposition_count: row.disposition_count ?? 0,
  created_at: String(row.created_at),
  updated_at: String(row.updated_at),
});

const requireLetter = async (id: number): Promise<IncomingLetterRow> => {
  const letter = await findIncomingLetterById(id);
  if (!letter) throw notFound('Surat masuk tidak ditemukan');
  return letter;
};

export const listIncomingLetters = async (filter: {
  status?: string;
  year?: number;
  search?: string;
  page?: number;
  perPage?: number;
}) => {
  const perPage = Math.min(Math.max(filter.perPage ?? 25, 1), 200);
  const page = Math.max(filter.page ?? 1, 1);
  const [items, total] = await Promise.all([
    findIncomingLetters({ ...filter, limit: perPage, offset: (page - 1) * perPage }),
    countIncomingLetters(filter),
  ]);
  return {
    items: items.map(toPublic),
    total,
    page,
    per_page: perPage,
    total_pages: Math.ceil(total / perPage),
  };
};

export const getIncomingLetterDetail = async (id: number) => {
  const letter = await requireLetter(id);
  const [dispositions, finals, references] = await Promise.all([
    findDispositions(id),
    findDispositionFinals(id),
    findReferences(id),
  ]);
  const { listByEntity } = await import('../../documents/service');
  const [documents, instance] = await Promise.all([
    listByEntity('incoming_letters', id),
    findInstanceProfile(),
  ]);
  return {
    ...toPublic(letter),
    dispositions,
    finals,
    references,
    documents,
    instance,
    verify_code: makeVerifyCode('incoming_letters', id),
  };
};

export const createIncomingLetter = async (input: IncomingLetterInput, actor: AuthUser) => {
  const id = await insertIncomingLetter({ ...input, created_by: Number(actor.id) });
  await insertAuditLog({
    actor_id: Number(actor.id),
    action: 'incoming_letter_create',
    entity_table: 'incoming_letters',
    entity_id: id,
    after_data: { letter_number: input.letter_number ?? null, origin: input.origin ?? null },
  });
  return { id, status: 'baru' as const };
};

export const updateIncomingLetterById = async (
  id: number,
  input: Record<string, unknown>,
  actor: AuthUser,
) => {
  const letter = await requireLetter(id);
  await updateIncomingLetter(id, input);
  await insertAuditLog({
    actor_id: Number(actor.id),
    action: 'incoming_letter_update',
    entity_table: 'incoming_letters',
    entity_id: id,
    before_data: { letter_number: letter.letter_number, status: letter.status },
    after_data: input,
  });
  return { id };
};

export const removeIncomingLetter = async (id: number, actor: AuthUser) => {
  await requireLetter(id);
  await deleteIncomingLetter(id);
  await insertAuditLog({
    actor_id: Number(actor.id),
    action: 'incoming_letter_delete',
    entity_table: 'incoming_letters',
    entity_id: id,
  });
};

export const finalizeIncomingLetterById = async (id: number, actor: AuthUser) => {
  const letter = await requireLetter(id);
  if (letter.status === 'selesai') {
    return { id, status: 'selesai' as const, repeated: true };
  }
  await markFinalized(id);
  await insertAuditLog({
    actor_id: Number(actor.id),
    action: 'incoming_letter_finalize',
    entity_table: 'incoming_letters',
    entity_id: id,
    before_data: { status: letter.status },
    after_data: { status: 'selesai' },
  });
  return { id, status: 'selesai' as const };
};

export const attachIncomingLetterFile = async (
  id: number,
  file: { buffer: Buffer; filename: string; mimeType?: string | null },
  field: string,
  actor: AuthUser,
) => {
  await requireLetter(id);
  const { uploadDocument } = await import('../../documents/service');
  const uploaded = await uploadDocument({
    buffer: file.buffer,
    filename: file.filename,
    mimeType: file.mimeType ?? null,
    entityTable: 'incoming_letters',
    entityId: id,
    field: field === 'sk' ? 'file_sk' : 'file_sm',
    label: field === 'sk' ? 'Berkas SK' : 'Berkas surat masuk',
    actorId: Number(actor.id),
  });
  await insertAuditLog({
    actor_id: Number(actor.id),
    action: 'incoming_letter_file_upload',
    entity_table: 'incoming_letters',
    entity_id: id,
    after_data: { field, document_id: uploaded.id },
  });
  return { id, document_id: uploaded.id, object_key: uploaded.object_key };
};

// ---------------------------------------------------------------------------
// Disposisi (pelaksana)
// ---------------------------------------------------------------------------

export const addDisposition = async (
  letterId: number,
  input: {
    target_name?: string;
    target_nip?: string;
    instruction?: string;
    notes?: string;
    sort_order?: number;
  },
  actor: AuthUser,
) => {
  await requireLetter(letterId);
  const id = await insertDisposition({ incoming_letter_id: letterId, ...input });
  await insertAuditLog({
    actor_id: Number(actor.id),
    action: 'disposition_add',
    entity_table: 'dispositions',
    entity_id: id,
    after_data: input,
  });
  return { id };
};

export const updateDispositionById = async (
  letterId: number,
  dispositionId: number,
  input: Record<string, unknown>,
  actor: AuthUser,
) => {
  await requireLetter(letterId);
  const disposition = await findDispositionById(dispositionId);
  if (!disposition || disposition.incoming_letter_id !== letterId) {
    throw notFound('Disposisi tidak ditemukan');
  }
  const data = { ...input } as Record<string, unknown>;
  if (typeof data.status === 'string') {
    data.decided_at = new Date().toISOString().slice(0, 19).replace('T', ' ');
  }
  await updateDisposition(dispositionId, data);
  return { id: dispositionId };
};

export const removeDisposition = async (
  letterId: number,
  dispositionId: number,
  actor: AuthUser,
) => {
  await requireLetter(letterId);
  const disposition = await findDispositionById(dispositionId);
  if (!disposition || disposition.incoming_letter_id !== letterId) {
    throw notFound('Disposisi tidak ditemukan');
  }
  await deleteDisposition(dispositionId);
};

// ---------------------------------------------------------------------------
// Final & referensi
// ---------------------------------------------------------------------------

export const addFinal = async (
  letterId: number,
  input: { name?: string; nip?: string; instruction?: string },
  actor: AuthUser,
) => {
  await requireLetter(letterId);
  const id = await insertDispositionFinal({ incoming_letter_id: letterId, ...input });
  await insertAuditLog({
    actor_id: Number(actor.id),
    action: 'disposition_final_add',
    entity_table: 'disposition_finals',
    entity_id: id,
    after_data: input,
  });
  return { id };
};

export const removeFinal = async (letterId: number, finalId: number, actor: AuthUser) => {
  await requireLetter(letterId);
  const row = await findDispositionFinalById(finalId);
  if (!row || row.incoming_letter_id !== letterId) throw notFound('Data final tidak ditemukan');
  await deleteDispositionFinal(finalId);
};

export const addReference = async (letterId: number, text: string, actor: AuthUser) => {
  await requireLetter(letterId);
  const id = await insertReference({ incoming_letter_id: letterId, reference_text: text });
  await insertAuditLog({
    actor_id: Number(actor.id),
    action: 'incoming_letter_reference_add',
    entity_table: 'incoming_letter_references',
    entity_id: id,
    after_data: { reference_text: text },
  });
  return { id };
};

export const removeReference = async (letterId: number, refId: number, actor: AuthUser) => {
  await requireLetter(letterId);
  const row = await findReferenceById(refId);
  if (!row || row.incoming_letter_id !== letterId) throw notFound('Referensi tidak ditemukan');
  await deleteReference(refId);
};

// ---------------------------------------------------------------------------
// Klasifikasi
// ---------------------------------------------------------------------------

export const listClassifications = async (filter: { search?: string; activeOnly?: boolean } = {}) =>
  findClassifications(filter);

export const createClassification = async (
  input: { code: string; name: string; description?: string; is_active?: boolean },
  actor: AuthUser,
) => {
  if (await findClassificationByCode(input.code)) {
    throw badRequest(`Kode klasifikasi "${input.code}" sudah dipakai`);
  }
  const id = await insertClassification({
    code: input.code,
    name: input.name,
    description: input.description ?? null,
    is_active: input.is_active === false ? 0 : 1,
  });
  await insertAuditLog({
    actor_id: Number(actor.id),
    action: 'classification_create',
    entity_table: 'letter_classifications',
    entity_id: id,
    after_data: input,
  });
  return { id };
};

export const updateClassificationById = async (
  id: number,
  input: { code?: string; name?: string; description?: string; is_active?: boolean },
  actor: AuthUser,
) => {
  const existing = await findClassificationById(id);
  if (!existing) throw notFound('Klasifikasi tidak ditemukan');
  if (input.code && input.code !== existing.code && (await findClassificationByCode(input.code))) {
    throw badRequest(`Kode klasifikasi "${input.code}" sudah dipakai`);
  }
  const patch: { code?: string; name?: string; description?: string; is_active?: number } = {};
  if (input.code !== undefined) patch.code = input.code;
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.is_active !== undefined) patch.is_active = input.is_active ? 1 : 0;
  await updateClassification(id, patch);
  return { id };
};

export const removeClassification = async (id: number, actor: AuthUser) => {
  const existing = await findClassificationById(id);
  if (!existing) throw notFound('Klasifikasi tidak ditemukan');
  await deleteClassification(id);
  await insertAuditLog({
    actor_id: Number(actor.id),
    action: 'classification_delete',
    entity_table: 'letter_classifications',
    entity_id: id,
  });
};
