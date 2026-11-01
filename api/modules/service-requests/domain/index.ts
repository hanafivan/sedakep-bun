import type { AuthUser } from '../../../middleware/bearerAuth';
import { badRequest, forbidden, notFound } from '../../../shared/errors';
import { SERVICE_TYPES, documentLabelsFor, getServiceTypeDef } from './service-types';
export * from './service-types';
import {
  deleteServiceRequest,
  insertAuditLog,
  insertGeneratedLetter,
  insertServiceCheck,
  insertServiceRequest,
  updateServiceDecision,
  updateServiceRequest,
  upsertServiceDocument,
  upsertServiceField,
} from '../command';
import {
  countServiceRequests,
  findGeneratedLetters,
  findInstanceProfile,
  findServiceChecks,
  findServiceDocuments,
  findServiceFields,
  findServiceRequestById,
  findServiceRequests,
  findUserProfileById,
} from '../query';
import type { ServiceRequestRow } from '../schema/types';

/**
 * Service layanan kepegawaian — aturan bisnis + orkestrasi. Tanpa SQL.
 *
 * Satu modul generik untuk banyak jenis layanan; nilai spesifik per jenis
 * divalidasi terhadap konfigurasi `domain/service-types.ts`.
 */

export type ServiceRequestInput = Partial<{
  service_type: string;
  user_id: number;
  title: string;
  phone: string;
  subtype: string;
  approver_1_name: string;
  approver_1_nip: string;
  approver_1_position: string;
  fields: Record<string, string>;
}>;

const nowStamp = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

const toPublic = (row: ServiceRequestRow) => ({
  id: row.id,
  service_type: row.service_type,
  user_id: row.user_id,
  name: row.name,
  nip: row.nip,
  grade: row.grade,
  position: row.position,
  organization_name: row.organization_name,
  phone: row.phone,
  title: row.title,
  campus: row.campus,
  faculty: row.faculty,
  major: row.major,
  subtype: row.subtype,
  approver_1_name: row.approver_1_name,
  approver_1_nip: row.approver_1_nip,
  approver_1_position: row.approver_1_position,
  status: row.status,
  decision: row.decision,
  approver_1_status: row.approver_1_status,
  decided_by: row.decided_by,
  decided_at: row.decided_at,
  decision_note: row.decision_note,
  printed_at: row.printed_at,
  created_at: String(row.created_at),
  updated_at: String(row.updated_at),
});

export const canViewService = (actor: AuthUser, request: { user_id: number }): boolean =>
  actor.role !== 'pegawai' || Number(actor.id) === Number(request.user_id);

export const canEditService = (actor: AuthUser, request: { user_id: number }): boolean =>
  actor.role === 'admin' || Number(actor.id) === Number(request.user_id);

const requireRequest = async (id: number): Promise<ServiceRequestRow> => {
  const request = await findServiceRequestById(id);
  if (!request) throw notFound('Permohonan layanan tidak ditemukan');
  return request;
};

const requireEditable = async (id: number, actor: AuthUser): Promise<ServiceRequestRow> => {
  const request = await requireRequest(id);
  if (!canEditService(actor, request)) throw forbidden('Tidak berhak mengubah permohonan ini');
  if (request.status === 'approved' || request.status === 'cancelled') {
    throw badRequest('Permohonan yang sudah final tidak dapat diubah');
  }
  return request;
};

export const getServiceMeta = () => ({
  types: Object.values(SERVICE_TYPES).map((def) => ({
    type: def.type,
    label: def.label,
    subtype_label: def.subtypeLabel ?? null,
    subtype_options: def.subtypeOptions ?? [],
    fields: def.fields,
    documents: def.documents,
    letters: def.letters,
  })),
});

export const listServiceRequests = async (filter: {
  serviceType?: string;
  status?: string;
  userId?: number;
  search?: string;
  page?: number;
  perPage?: number;
}) => {
  const perPage = Math.min(Math.max(filter.perPage ?? 25, 1), 200);
  const page = Math.max(filter.page ?? 1, 1);
  const [items, total] = await Promise.all([
    findServiceRequests({ ...filter, limit: perPage, offset: (page - 1) * perPage }),
    countServiceRequests(filter),
  ]);
  return {
    items: items.map(toPublic),
    total,
    page,
    per_page: perPage,
    total_pages: Math.ceil(total / perPage),
  };
};

export const getServiceRequestDetail = async (id: number) => {
  const request = await requireRequest(id);
  const [fields, serviceDocuments, checks, letters] = await Promise.all([
    findServiceFields(id),
    findServiceDocuments(id),
    findServiceChecks(id),
    findGeneratedLetters('service_requests', id),
  ]);
  const { listByEntity } = await import('../../documents/domain');
  const [documents, instance] = await Promise.all([
    listByEntity('service_requests', id),
    findInstanceProfile(),
  ]);

  const fieldMap: Record<string, string | null> = {};
  for (const row of fields) fieldMap[row.field_key] = row.field_value;

  return {
    ...toPublic(request),
    fields: fieldMap,
    service_documents: serviceDocuments,
    checks,
    letters,
    documents,
    instance,
  };
};

export const createServiceRequest = async (input: ServiceRequestInput, actor: AuthUser) => {
  const type = input.service_type ?? '';
  const def = getServiceTypeDef(type);
  if (!def) throw badRequest(`Jenis layanan "${type}" tidak dikenal`);

  const userId = input.user_id ?? Number(actor.id);
  if (Number(actor.id) !== userId && actor.role !== 'admin') {
    throw forbidden('Tidak berhak membuat permohonan untuk pegawai lain');
  }
  const profile = await findUserProfileById(userId);
  if (!profile) throw badRequest('Pegawai tidak ditemukan');

  const id = await insertServiceRequest({
    legacy_table: type,
    service_type: type,
    user_id: userId,
    name: profile.name,
    nip: profile.nip,
    grade: profile.grade,
    position: profile.position_name,
    organization_name: profile.unit_name,
    phone: input.phone ?? null,
    title: input.title ?? null,
    subtype: input.subtype ?? null,
    approver_1_name: input.approver_1_name ?? null,
    approver_1_nip: input.approver_1_nip ?? null,
    approver_1_position: input.approver_1_position ?? null,
  });

  if (input.fields) {
    for (const [key, value] of Object.entries(input.fields)) {
      await upsertServiceField(id, key, value);
    }
  }

  await insertAuditLog({
    actor_id: Number(actor.id),
    action: 'service_request_create',
    entity_table: 'service_requests',
    entity_id: id,
    after_data: { service_type: type, title: input.title ?? null },
  });
  return { id, service_type: type };
};

export const updateServiceRequestById = async (
  id: number,
  input: ServiceRequestInput,
  actor: AuthUser,
) => {
  await requireEditable(id, actor);
  const patch: Record<string, unknown> = {};
  for (const key of [
    'title',
    'phone',
    'subtype',
    'approver_1_name',
    'approver_1_nip',
    'approver_1_position',
  ] as const) {
    if (input[key] !== undefined) patch[key] = input[key];
  }
  await updateServiceRequest(id, patch);
  if (input.fields) {
    for (const [key, value] of Object.entries(input.fields)) {
      await upsertServiceField(id, key, value);
    }
  }
  return { id };
};

export const removeServiceRequest = async (id: number, actor: AuthUser) => {
  const request = await requireRequest(id);
  if (!canEditService(actor, request)) throw forbidden('Tidak berhak menghapus permohonan ini');
  if (request.status === 'approved') {
    throw badRequest('Permohonan yang sudah disetujui tidak dapat dihapus');
  }
  await deleteServiceRequest(id);
  await insertAuditLog({
    actor_id: Number(actor.id),
    action: 'service_request_delete',
    entity_table: 'service_requests',
    entity_id: id,
  });
};

/** Verifikasi/keputusan staf. Satu tingkat approval (kolom approver_1). */
export const decideServiceRequest = async (
  id: number,
  input: { decision: 'accepted' | 'rejected' | 'cancelled'; note?: string },
  actor: AuthUser,
) => {
  const request = await requireRequest(id);
  if (request.decision === input.decision) {
    return { id, status: request.status, repeated: true };
  }
  const status =
    input.decision === 'accepted'
      ? 'approved'
      : input.decision === 'rejected'
        ? 'rejected'
        : 'cancelled';
  await updateServiceDecision(id, {
    decision: input.decision,
    status,
    approver_1_status: input.decision === 'cancelled' ? undefined : input.decision,
    decided_by: Number(actor.id),
    decided_at: nowStamp(),
    decision_note: input.note ?? null,
  });
  await insertAuditLog({
    actor_id: Number(actor.id),
    action: `service_request_${input.decision}`,
    entity_table: 'service_requests',
    entity_id: id,
    before_data: { status: request.status, decision: request.decision },
    after_data: { status, decision: input.decision, note: input.note ?? null },
  });
  return { id, status };
};

export const setServiceFields = async (
  id: number,
  fields: Record<string, string>,
  actor: AuthUser,
) => {
  await requireEditable(id, actor);
  for (const [key, value] of Object.entries(fields)) {
    await upsertServiceField(id, key, value);
  }
  return { id };
};

export const attachServiceDocument = async (
  id: number,
  label: string,
  file: { buffer: Buffer; filename: string; mimeType?: string | null },
  actor: AuthUser,
) => {
  const request = await requireEditable(id, actor);
  const allowed = documentLabelsFor(request.service_type);
  if (!allowed.includes(label)) {
    throw badRequest(`Label dokumen "${label}" tidak berlaku untuk jenis ${request.service_type}`);
  }

  const { uploadDocument } = await import('../../documents/domain');
  const uploaded = await uploadDocument({
    buffer: file.buffer,
    filename: file.filename,
    mimeType: file.mimeType ?? null,
    entityTable: 'service_requests',
    entityId: id,
    field: label,
    label,
    actorId: Number(actor.id),
  });
  await upsertServiceDocument(id, label, uploaded.id);
  await insertAuditLog({
    actor_id: Number(actor.id),
    action: 'service_document_upload',
    entity_table: 'service_documents',
    entity_id: id,
    after_data: { label, document_id: uploaded.id },
  });
  return { id, label, document_id: uploaded.id, object_key: uploaded.object_key };
};

export const addServiceCheck = async (
  id: number,
  input: { check_type: string; result?: string; notes?: string },
  actor: AuthUser,
) => {
  await requireRequest(id);
  const checkId = await insertServiceCheck({
    request_id: id,
    check_type: input.check_type,
    result: input.result ?? null,
    notes: input.notes ?? null,
    checked_by: Number(actor.id),
  });
  return { id: checkId };
};

export const addGeneratedLetter = async (
  id: number,
  input: { letter_type: 'sphd' | 'sppid' | 'sk' | 'suket'; number?: string; issued_at?: string },
  actor: AuthUser,
) => {
  const request = await requireRequest(id);
  const def = getServiceTypeDef(request.service_type);
  if (def && def.letters.length > 0 && !def.letters.includes(input.letter_type)) {
    throw badRequest(`Surat "${input.letter_type}" tidak berlaku untuk jenis ${request.service_type}`);
  }
  const letterId = await insertGeneratedLetter({
    letter_type: input.letter_type,
    entity_table: 'service_requests',
    entity_id: id,
    number: input.number ?? null,
    issued_at: input.issued_at ?? new Date().toISOString().slice(0, 10),
  });
  await insertAuditLog({
    actor_id: Number(actor.id),
    action: 'service_letter_create',
    entity_table: 'generated_letters',
    entity_id: letterId,
    after_data: input,
  });
  return { id: letterId };
};

const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const formatDateId = (value: string | null | undefined): string => {
  if (!value) return '-';
  const parts = String(value).slice(0, 10).split('-');
  if (parts.length !== 3) return String(value);
  const [y, m, d] = parts;
  return `${Number(d)} ${MONTHS_ID[Number(m) - 1] ?? m} ${y}`;
};

const LETTER_TITLES: Record<string, string> = {
  sphd: 'SURAT PENGUMUMAN HASIL (SPHD)',
  sppid: 'SURAT PENGUMUMAN PEMBERIAN IZIN (SPPID)',
  suket: 'SURAT KETERANGAN',
  sk: 'SURAT KEPUTUSAN',
};

/** Hasilkan PDF surat layanan (SPHD/SK/dll) + QR, simpan ke MinIO. */
export const generateServiceLetterPdf = async (id: number, actor: AuthUser) => {
  const detail = await getServiceRequestDetail(id);
  const def = getServiceTypeDef(detail.service_type);
  const letterType = (def?.letters[0] ?? 'sk') as 'sphd' | 'sppid' | 'sk' | 'suket';
  const instance = (detail.instance ?? {}) as Record<string, string | null>;

  const { buildLetterPdf } = await import('../../../shared/pdf');
  const { verifyUrl } = await import('../../../shared/verify');
  const link = verifyUrl('service_requests', id);

  const fieldRows = (def?.fields ?? []).map((field) => [
    field.label,
    (detail.fields as Record<string, string | null>)[field.key] ?? '-',
  ]);

  const pdf = await buildLetterPdf({
    kop: [instance.name ?? 'KEMENTERIAN AGAMA', instance.address ?? ''].filter((value) =>
      Boolean(value),
    ),
    title: LETTER_TITLES[letterType] ?? 'SURAT',
    subtitle: `${def?.label ?? detail.service_type}${detail.title ? ` — ${detail.title}` : ''}`,
    paragraphs: [
      'Yang bertanda tangan di bawah ini, memperhatikan permohonan yang bersangkutan, menetapkan kepada:',
      `Nama: ${detail.name}`,
      `NIP: ${detail.nip ?? '-'}`,
      `Jabatan: ${detail.position ?? '-'}`,
      `Unit kerja: ${detail.organization_name ?? '-'}`,
    ],
    table: fieldRows.length > 0 ? { headers: ['Keterangan', 'Nilai'], rows: fieldRows } : undefined,
    signer: {
      city: instance.address ?? '',
      date: formatDateId(new Date().toISOString()),
      position: instance.status ?? '',
      name: instance.head_name ?? '',
    },
    qr: { text: link },
  });

  const { uploadDocument, getDownloadUrl } = await import('../../documents/domain');
  const uploaded = await uploadDocument({
    buffer: Buffer.from(pdf),
    filename: `${detail.service_type}-${id}.pdf`,
    mimeType: 'application/pdf',
    entityTable: 'service_requests',
    entityId: id,
    field: 'pdf',
    label: 'PDF surat layanan',
    actorId: Number(actor.id),
  });

  const letterId = await insertGeneratedLetter({
    letter_type: letterType,
    entity_table: 'service_requests',
    entity_id: id,
    number: detail.title ?? null,
    document_id: uploaded.id,
    issued_at: new Date().toISOString().slice(0, 10),
  });

  const download = await getDownloadUrl(uploaded.id);
  await insertAuditLog({
    actor_id: Number(actor.id),
    action: 'service_pdf_generate',
    entity_table: 'service_requests',
    entity_id: id,
    after_data: { document_id: uploaded.id, letter_type: letterType },
  });
  return { document_id: uploaded.id, url: download.url, verify_url: link, letter_id: letterId };
};
