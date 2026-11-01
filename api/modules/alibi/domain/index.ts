import type { AuthUser } from '../../../middleware/bearerAuth';
import { badRequest, forbidden, notFound } from '../../../shared/errors';
import { makeVerifyCode } from '../../../shared/verify';
import {
  deleteAlibiRequest,
  insertAlibiRequest,
  insertAuditLog,
  markAlibiPrinted,
  updateAlibiDecision,
  updateAlibiRequest,
} from '../command';
import {
  countAlibiRequests,
  findAlibiRequestById,
  findAlibiRequests,
  findInstanceProfile,
  findUserNipById,
  findUserProfileById,
} from '../query';
import type { AlibiRequestRow, AlibiStatus } from '../schema/types';

/**
 * Service alibi — aturan bisnis + orkestrasi. Tidak ada SQL di file ini.
 *
 * Approval tiga tingkat seperti legacy: admin (level 1 legacy) → atasan 1 →
 * atasan 2. Status akhir diturunkan dari kombinasi keputusan; bukan mutasi
 * manual. Di legacy keputusan disimpan di `hlm_alibi_acc`.
 */

export type AlibiInput = Partial<{
  user_id: number;
  day_count: string;
  alibi_date: string;
  alibi_type: string;
  reason: string;
  time_start: string;
  time_end: string;
  approver_1_name: string;
  approver_1_nip: string;
  approver_1_position: string;
  approver_2_name: string;
  approver_2_nip: string;
  approver_2_position: string;
}>;

const nowStamp = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const today = () => new Date().toISOString().slice(0, 10);

const deriveStatus = (
  adminDecision: string,
  approver1: string,
  approver2: string,
): AlibiStatus => {
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

const toPublic = (row: AlibiRequestRow) => ({
  id: row.id,
  user_id: row.user_id,
  name: row.name,
  nip: row.nip,
  grade: row.grade,
  position: row.position,
  organization_name: row.organization_name,
  day_count: row.day_count,
  alibi_date: row.alibi_date,
  alibi_type: row.alibi_type,
  reason: row.reason,
  time_start: row.time_start,
  time_end: row.time_end,
  approver_1_name: row.approver_1_name,
  approver_1_nip: row.approver_1_nip,
  approver_1_position: row.approver_1_position,
  approver_2_name: row.approver_2_name,
  approver_2_nip: row.approver_2_nip,
  approver_2_position: row.approver_2_position,
  status: row.status,
  admin_decision: row.admin_decision,
  approver_1_status: row.approver_1_status,
  approver_2_status: row.approver_2_status,
  admin_decided_at: row.admin_decided_at,
  approver_1_decided_at: row.approver_1_decided_at,
  approver_2_decided_at: row.approver_2_decided_at,
  verdict_note: row.verdict_note,
  printed_at: row.printed_at,
  created_at: String(row.created_at),
  updated_at: String(row.updated_at),
});

export const canViewAlibi = (actor: AuthUser, alibi: { user_id: number }): boolean =>
  actor.role !== 'pegawai' || Number(actor.id) === Number(alibi.user_id);

export const canEditAlibi = (actor: AuthUser, alibi: { user_id: number }): boolean =>
  actor.role === 'admin' || Number(actor.id) === Number(alibi.user_id);

const assertCanEdit = (actor: AuthUser, alibi: { user_id: number }) => {
  if (!canEditAlibi(actor, alibi)) throw forbidden('Tidak berhak mengubah alibi ini');
};

const requireEditable = async (id: number, actor: AuthUser): Promise<AlibiRequestRow> => {
  const alibi = await findAlibiRequestById(id);
  if (!alibi) throw notFound('Alibi tidak ditemukan');
  assertCanEdit(actor, alibi);
  if (alibi.status === 'approved' || alibi.status === 'cancelled') {
    throw badRequest('Alibi yang sudah final atau dibatalkan tidak dapat diubah');
  }
  return alibi;
};

export const listAlibiRequests = async (filter: {
  userId?: number;
  status?: string;
  year?: number;
  search?: string;
  page?: number;
  perPage?: number;
}) => {
  const perPage = Math.min(Math.max(filter.perPage ?? 25, 1), 200);
  const page = Math.max(filter.page ?? 1, 1);
  const [items, total] = await Promise.all([
    findAlibiRequests({ ...filter, limit: perPage, offset: (page - 1) * perPage }),
    countAlibiRequests(filter),
  ]);
  return {
    items: items.map(toPublic),
    total,
    page,
    per_page: perPage,
    total_pages: Math.ceil(total / perPage),
  };
};

export const getAlibiRequestDetail = async (id: number) => {
  const alibi = await findAlibiRequestById(id);
  if (!alibi) throw notFound('Alibi tidak ditemukan');

  const { listByEntity } = await import('../../documents/domain');
  const [documents, instance] = await Promise.all([
    listByEntity('alibi_requests', id),
    findInstanceProfile(),
  ]);
  return { ...toPublic(alibi), documents, instance, verify_code: makeVerifyCode('alibi_requests', id) };
};

export const createAlibiRequest = async (input: AlibiInput, actor: AuthUser) => {
  const userId = input.user_id ?? Number(actor.id);
  if (Number(actor.id) !== userId && actor.role !== 'admin') {
    throw forbidden('Tidak berhak membuat alibi untuk pegawai lain');
  }
  const nip = await findUserNipById(userId);
  if (!nip) throw badRequest('Pegawai tidak memiliki NIP');
  const profile = await findUserProfileById(userId);

  const id = await insertAlibiRequest({
    user_id: userId,
    name: profile?.name ?? '',
    nip,
    grade: profile?.grade ?? null,
    position: profile?.position_name ?? null,
    organization_name: profile?.organization_name ?? profile?.unit_name ?? null,
    day_count: input.day_count ?? null,
    alibi_date: input.alibi_date ?? null,
    alibi_type: input.alibi_type ?? null,
    reason: input.reason ?? null,
    time_start: input.time_start ?? null,
    time_end: input.time_end ?? null,
    approver_1_name: input.approver_1_name ?? null,
    approver_1_nip: input.approver_1_nip ?? null,
    approver_1_position: input.approver_1_position ?? null,
    approver_2_name: input.approver_2_name ?? null,
    approver_2_nip: input.approver_2_nip ?? null,
    approver_2_position: input.approver_2_position ?? null,
  });

  await insertAuditLog({
    actor_id: Number(actor.id),
    action: 'alibi_create',
    entity_table: 'alibi_requests',
    entity_id: id,
    after_data: { user_id: userId, alibi_type: input.alibi_type ?? null },
  });
  return { id, status: 'submitted' as const };
};

export const updateAlibiRequestById = async (
  id: number,
  input: Record<string, unknown>,
  actor: AuthUser,
) => {
  const alibi = await requireEditable(id, actor);
  await updateAlibiRequest(id, input);
  await insertAuditLog({
    actor_id: Number(actor.id),
    action: 'alibi_update',
    entity_table: 'alibi_requests',
    entity_id: id,
    before_data: { alibi_type: alibi.alibi_type, alibi_date: alibi.alibi_date },
    after_data: input,
  });
  return { id };
};

export const removeAlibiRequest = async (id: number, actor: AuthUser) => {
  const alibi = await findAlibiRequestById(id);
  if (!alibi) throw notFound('Alibi tidak ditemukan');
  assertCanEdit(actor, alibi);
  if (alibi.status === 'approved') {
    throw badRequest('Alibi yang sudah disetujui tidak dapat dihapus');
  }
  await deleteAlibiRequest(id);
  await insertAuditLog({
    actor_id: Number(actor.id),
    action: 'alibi_delete',
    entity_table: 'alibi_requests',
    entity_id: id,
    before_data: { status: alibi.status },
  });
};

export const decideAlibiAdmin = async (
  id: number,
  input: { decision: 'accepted' | 'rejected' | 'cancelled'; note?: string },
  actor: AuthUser,
) => {
  const alibi = await findAlibiRequestById(id);
  if (!alibi) throw notFound('Alibi tidak ditemukan');

  const status = deriveStatus(input.decision, alibi.approver_1_status, alibi.approver_2_status);
  await updateAlibiDecision(id, {
    admin_decision: input.decision,
    admin_decided_at: nowStamp(),
    status,
    verdict_note: input.note ?? alibi.verdict_note,
  });
  await insertAuditLog({
    actor_id: Number(actor.id),
    action: `alibi_admin_${input.decision}`,
    entity_table: 'alibi_requests',
    entity_id: id,
    before_data: { status: alibi.status, admin_decision: alibi.admin_decision },
    after_data: { status, admin_decision: input.decision, note: input.note ?? null },
  });
  return { id, status };
};

export const decideAlibiApprover = async (
  id: number,
  level: 1 | 2,
  input: { decision: 'accepted' | 'rejected'; note?: string },
  actor: AuthUser,
) => {
  const alibi = await findAlibiRequestById(id);
  if (!alibi) throw notFound('Alibi tidak ditemukan');

  if (level === 2 && alibi.approver_1_status !== 'accepted') {
    throw badRequest('Approval atasan 1 harus selesai lebih dulu');
  }

  const existing = level === 1 ? alibi.approver_1_status : alibi.approver_2_status;
  if (existing === input.decision) {
    return { id, status: alibi.status, repeated: true };
  }

  const nextApprover1 = level === 1 ? input.decision : alibi.approver_1_status;
  const nextApprover2 = level === 2 ? input.decision : alibi.approver_2_status;
  const status = deriveStatus(alibi.admin_decision, nextApprover1, nextApprover2);

  await updateAlibiDecision(id, {
    ...(level === 1
      ? { approver_1_status: input.decision, approver_1_decided_at: nowStamp() }
      : { approver_2_status: input.decision, approver_2_decided_at: nowStamp() }),
    status,
    ...(input.decision === 'rejected' && input.note ? { verdict_note: input.note } : {}),
  });
  await insertAuditLog({
    actor_id: Number(actor.id),
    action: `alibi_approver_${level}_${input.decision}`,
    entity_table: 'alibi_requests',
    entity_id: id,
    before_data: { status: alibi.status },
    after_data: { status, level, decision: input.decision },
  });
  return { id, status };
};

export const cancelAlibi = async (id: number, actor: AuthUser, note?: string) => {
  const alibi = await findAlibiRequestById(id);
  if (!alibi) throw notFound('Alibi tidak ditemukan');
  assertCanEdit(actor, alibi);
  if (alibi.status === 'cancelled') {
    return { id, status: 'cancelled' as const, repeated: true };
  }
  if (alibi.status === 'approved') {
    throw badRequest('Alibi yang sudah disetujui tidak dapat dibatalkan');
  }

  await updateAlibiDecision(id, {
    status: 'cancelled',
    admin_decision: 'cancelled',
    verdict_note: note ?? 'Dibatalkan',
  });
  await insertAuditLog({
    actor_id: Number(actor.id),
    action: 'alibi_cancel',
    entity_table: 'alibi_requests',
    entity_id: id,
    before_data: { status: alibi.status },
    after_data: { status: 'cancelled', note: note ?? null },
  });
  return { id, status: 'cancelled' as const };
};

export const attachAlibiFile = async (
  id: number,
  file: { buffer: Buffer; filename: string; mimeType?: string | null },
  actor: AuthUser,
) => {
  const alibi = await findAlibiRequestById(id);
  if (!alibi) throw notFound('Alibi tidak ditemukan');

  const { uploadDocument } = await import('../../documents/domain');
  const uploaded = await uploadDocument({
    buffer: file.buffer,
    filename: file.filename,
    mimeType: file.mimeType ?? null,
    entityTable: 'alibi_requests',
    entityId: id,
    field: 'file_alibi',
    label: 'Berkas alibi',
    actorId: Number(actor.id),
  });

  await markAlibiPrinted(id, today());
  await insertAuditLog({
    actor_id: Number(actor.id),
    action: 'alibi_file_upload',
    entity_table: 'alibi_requests',
    entity_id: id,
    after_data: { document_id: uploaded.id },
  });

  return { id, document_id: uploaded.id, object_key: uploaded.object_key };
};

export const getAlibiPrintData = async (id: number) => getAlibiRequestDetail(id);
