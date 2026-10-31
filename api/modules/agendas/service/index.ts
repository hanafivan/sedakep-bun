import type { AuthUser } from '../../../middleware/bearerAuth';
import { forbidden, notFound } from '../../../shared/errors';
import { deleteAgenda, insertAgenda, insertAuditLog, setAgendaReport, updateAgenda } from '../command';
import {
  countAgendas,
  findAgendaById,
  findAgendas,
  findInstanceProfile,
  findUserProfileById,
} from '../query';
import type { AgendaRow } from '../schema/types';

/**
 * Service agenda — aturan bisnis + orkestrasi. Tidak ada SQL di file ini.
 *
 * Cerminan legacy `agenda/*.php`: pemilik mengelola agendanya sendiri, staf
 * melihat semua, dan laporan diisi setelah agenda berjalan.
 */

export type AgendaInput = Partial<{
  title: string;
  place: string;
  start_at: string;
  end_at: string;
  report: string;
}>;

/** `2026-05-01T08:00` → `2026-05-01 08:00:00` agar cocok kolom DATETIME. */
const toDateTime = (value: string | undefined | null): string | null => {
  if (!value) return null;
  const normalized = value.replace('T', ' ').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return `${normalized} 00:00:00`;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(normalized)) return `${normalized}:00`;
  return normalized;
};

const toPublic = (row: AgendaRow) => ({
  id: row.id,
  user_id: row.user_id,
  name: row.name,
  nip: row.nip,
  title: row.title,
  place: row.place,
  start_at: row.start_at ? String(row.start_at) : null,
  end_at: row.end_at ? String(row.end_at) : null,
  report: row.report,
  reported_at: row.reported_at ? String(row.reported_at) : null,
  created_at: String(row.created_at),
  updated_at: String(row.updated_at),
});

export const canViewAgenda = (actor: AuthUser, agenda: { user_id: number }): boolean =>
  actor.role !== 'pegawai' || Number(actor.id) === Number(agenda.user_id);

export const canEditAgenda = (actor: AuthUser, agenda: { user_id: number }): boolean =>
  actor.role === 'admin' || Number(actor.id) === Number(agenda.user_id);

const requireEditable = async (id: number, actor: AuthUser): Promise<AgendaRow> => {
  const agenda = await findAgendaById(id);
  if (!agenda) throw notFound('Agenda tidak ditemukan');
  if (!canEditAgenda(actor, agenda)) throw forbidden('Tidak berhak mengubah agenda ini');
  return agenda;
};

export const listAgendas = async (filter: {
  userId?: number;
  year?: number;
  month?: number;
  search?: string;
  page?: number;
  perPage?: number;
}) => {
  const perPage = Math.min(Math.max(filter.perPage ?? 25, 1), 200);
  const page = Math.max(filter.page ?? 1, 1);
  const [items, total] = await Promise.all([
    findAgendas({ ...filter, limit: perPage, offset: (page - 1) * perPage }),
    countAgendas(filter),
  ]);
  return {
    items: items.map(toPublic),
    total,
    page,
    per_page: perPage,
    total_pages: Math.ceil(total / perPage),
  };
};

export const getAgendaDetail = async (id: number) => {
  const agenda = await findAgendaById(id);
  if (!agenda) throw notFound('Agenda tidak ditemukan');
  const { listByEntity } = await import('../../documents/service');
  const [documents, instance] = await Promise.all([
    listByEntity('agendas', id),
    findInstanceProfile(),
  ]);
  return { ...toPublic(agenda), documents, instance };
};

export const createAgenda = async (input: AgendaInput, actor: AuthUser) => {
  const userId = Number(actor.id);
  const profile = await findUserProfileById(userId);
  const id = await insertAgenda({
    user_id: userId,
    name: profile?.name ?? null,
    nip: profile?.nip ?? null,
    title: input.title ?? '',
    place: input.place ?? null,
    start_at: toDateTime(input.start_at),
    end_at: toDateTime(input.end_at),
    report: input.report ?? null,
  });
  await insertAuditLog({
    actor_id: userId,
    action: 'agenda_create',
    entity_table: 'agendas',
    entity_id: id,
    after_data: { title: input.title ?? null },
  });
  return { id };
};

export const updateAgendaById = async (id: number, input: AgendaInput, actor: AuthUser) => {
  const agenda = await requireEditable(id, actor);
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.place !== undefined) patch.place = input.place;
  if (input.start_at !== undefined) patch.start_at = toDateTime(input.start_at);
  if (input.end_at !== undefined) patch.end_at = toDateTime(input.end_at);
  if (input.report !== undefined) patch.report = input.report;
  await updateAgenda(id, patch);
  await insertAuditLog({
    actor_id: Number(actor.id),
    action: 'agenda_update',
    entity_table: 'agendas',
    entity_id: id,
    before_data: { title: agenda.title },
    after_data: patch,
  });
  return { id };
};

export const removeAgenda = async (id: number, actor: AuthUser) => {
  await requireEditable(id, actor);
  await deleteAgenda(id);
  await insertAuditLog({
    actor_id: Number(actor.id),
    action: 'agenda_delete',
    entity_table: 'agendas',
    entity_id: id,
  });
};

export const setAgendaReportById = async (id: number, report: string, actor: AuthUser) => {
  await requireEditable(id, actor);
  await setAgendaReport(id, report);
  await insertAuditLog({
    actor_id: Number(actor.id),
    action: 'agenda_report_set',
    entity_table: 'agendas',
    entity_id: id,
    after_data: { report },
  });
  return { id };
};

export const attachAgendaFile = async (
  id: number,
  file: { buffer: Buffer; filename: string; mimeType?: string | null },
  actor: AuthUser,
) => {
  await requireEditable(id, actor);
  const { uploadDocument } = await import('../../documents/service');
  const uploaded = await uploadDocument({
    buffer: file.buffer,
    filename: file.filename,
    mimeType: file.mimeType ?? null,
    entityTable: 'agendas',
    entityId: id,
    field: 'report_file',
    label: 'Berkas laporan agenda',
    actorId: Number(actor.id),
  });
  await insertAuditLog({
    actor_id: Number(actor.id),
    action: 'agenda_file_upload',
    entity_table: 'agendas',
    entity_id: id,
    after_data: { document_id: uploaded.id },
  });
  return { id, document_id: uploaded.id, object_key: uploaded.object_key };
};
