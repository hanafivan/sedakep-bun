import type { AuthUser } from '../../middleware/bearerAuth';
import { canSeeAll } from '../../middleware/roleGuard';
import { badRequest, forbidden } from '../../shared/errors';
import { successBody } from '../../shared/response';
import type { AppRouteHandler } from '../../shared/types';
import * as domain from './domain';
import * as routes from './leave-requests.routes';

const actor = (c: { get: (key: 'user') => AuthUser }): AuthUser => c.get('user');

/** `{user_id}` boleh berisi `me` (milik user login) atau id numerik. */
const resolveUserId = (param: string | number, actorId: number): number => {
  if (param === 'me') return actorId;
  const value = Number(param);
  if (!Number.isInteger(value) || value <= 0) throw badRequest('user_id tidak valid');
  return value;
};

/** Pegawai hanya menyentuh datanya sendiri; staf (admin/verifikator/atasan) semua. */
const applyScope = (userId: number, user: AuthUser): number => {
  return canSeeAll(user.role) || Number(user.id) === userId ? userId : Number(user.id);
};

const yearNow = () => new Date().getFullYear();

const toUpload = async (file: File) => ({
  buffer: Buffer.from(await file.arrayBuffer()),
  filename: file.name || 'berkas',
  mimeType: file.type || null,
});

// ---------------------------------------------------------------------------
// Permohonan cuti
// ---------------------------------------------------------------------------

export const listLeaveRequests: AppRouteHandler<routes.ListLeaveRequestsRoute> = async (c) => {
  const query = c.req.valid('query');
  const user = actor(c);

  // Pegawai hanya melihat permohonannya sendiri. Admin/verifikator/atasan
  // melihat semua, kecuali mereka menyebut user_id tertentu.
  const scopedUserId = query.user_id ?? (canSeeAll(user.role) ? undefined : Number(user.id));

  const result = await domain.listLeaveRequests({
    userId: scopedUserId,
    leaveType: query.leave_type,
    status: query.status,
    adminDecision: query.admin_decision,
    approverLevel: query.approver_level,
    approverStatus: query.approver_status,
    approverNip: query.approver_nip,
    year: query.year,
    search: query.search,
    letterStatus: query.letter_status,
    fileStatus: query.file_status,
    archive: query.archive,
    page: query.page,
    perPage: query.per_page,
  });
  return c.json(successBody(result, 'Daftar permohonan cuti'), 200);
};

export const approvalSummary: AppRouteHandler<routes.ApprovalSummaryRoute> = async (c) => {
  const query = c.req.valid('query');
  const user = actor(c);
  const actorNip = await domain.getActorNip(Number(user.id));
  const approverNip = query.approver_nip ?? (actorNip || undefined);
  const summary = await domain.getApprovalSummary({ approverNip });
  return c.json(successBody(summary, 'Ringkasan antrean persetujuan cuti'), 200);
};

export const leaveStatistics: AppRouteHandler<routes.LeaveStatisticsRoute> = async (c) => {
  const query = c.req.valid('query');
  const user = actor(c);
  const stats = await domain.getLeaveStatistics({
    userId: query.user_id ?? (canSeeAll(user.role) ? undefined : Number(user.id)),
    year: query.year,
  });
  return c.json(successBody(stats, 'Rekap permohonan cuti'), 200);
};

export const leaveTypeOptions: AppRouteHandler<routes.LeaveTypeOptionsRoute> = async (c) => {
  const { user_id } = c.req.valid('param');
  const user = actor(c);
  const options = await domain.getLeaveTypeOptions(applyScope(resolveUserId(user_id, Number(user.id)), user));
  return c.json(successBody(options, 'Jenis cuti yang boleh diajukan'), 200);
};

export const approverSuggestions: AppRouteHandler<routes.ApproverSuggestionsRoute> = async (c) => {
  const query = c.req.valid('query');
  const suggestions = await domain.getApproverSuggestions(query.search);
  return c.json(successBody(suggestions, 'Daftar saran atasan/pejabat'), 200);
};

export const getLeaveRequest: AppRouteHandler<routes.GetLeaveRequestRoute> = async (c) => {
  const { id } = c.req.valid('param');
  const user = actor(c);
  const detail = await domain.getLeaveRequestDetail(id);
  if (!domain.canViewRequest(user, detail)) {
    throw badRequest('Permohonan cuti tidak ditemukan');
  }
  return c.json(successBody(detail, 'Detail permohonan cuti'), 200);
};

export const generateLeavePdf: AppRouteHandler<routes.GenerateLeavePdfRoute> = async (c) => {
  const { id } = c.req.valid('param');
  const user = actor(c);
  const existing = await domain.getLeaveRequestDetail(id);
  if (!domain.canViewRequest(user, existing)) {
    throw badRequest('Permohonan cuti tidak ditemukan');
  }
  const result = await domain.generateLeaveLetterPdf(id, user);
  return c.json(successBody(result, 'PDF surat keterangan cuti dibuat'), 200);
};

export const generateLeaveFormPdf: AppRouteHandler<routes.GenerateLeaveFormPdfRoute> = async (c) => {
  const { id } = c.req.valid('param');
  const user = actor(c);
  const existing = await domain.getLeaveRequestDetail(id);
  if (!domain.canViewRequest(user, existing)) {
    throw badRequest('Permohonan cuti tidak ditemukan');
  }
  const result = await domain.generateLeaveFormPdf(id, user);
  return c.json(successBody(result, 'Formulir permohonan cuti dibuat'), 200);
};

export const createLeaveRequest: AppRouteHandler<routes.CreateLeaveRequestRoute> = async (c) => {
  const isMultipart = (c.req.header('content-type') ?? '').includes('multipart/form-data');
  const body = isMultipart ? c.req.valid('form') : c.req.valid('json');
  const file = isMultipart && 'file' in body && body.file instanceof File ? body.file : null;
  const user = actor(c);

  // Pegawai selalu mengajukan atas namanya sendiri; admin boleh menunjuk user lain.
  const requestedUserId = Number(body.user_id ?? user.id);
  const userId =
    user.role === 'admin' || user.role === 'pegawai' || requestedUserId === Number(user.id)
      ? requestedUserId
      : Number(user.id);

  const result = await domain.createLeaveRequest({
    ...(body as unknown as domain.CreateLeaveInput),
    user_id: userId,
    attachment: file ? await toUpload(file) : undefined,
  });
  return c.json(successBody(result, 'Permohonan cuti dibuat'), 200);
};

export const updateLeaveRequest: AppRouteHandler<routes.UpdateLeaveRequestRoute> = async (c) => {
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const existing = await domain.getLeaveRequestDetail(id);
  if (!domain.canEditRequest(actor(c), existing)) {
    throw badRequest('Tidak berhak menyunting permohonan milik pegawai lain');
  }

  const result = await domain.updateLeaveRequestById(id, body);
  return c.json(successBody(result, 'Permohonan cuti diubah'), 200);
};

export const deleteLeaveRequest: AppRouteHandler<routes.DeleteLeaveRequestRoute> = async (c) => {
  const { id } = c.req.valid('param');
  const existing = await domain.getLeaveRequestDetail(id);
  if (!domain.canEditRequest(actor(c), existing)) {
    throw badRequest('Tidak berhak menghapus permohonan milik pegawai lain');
  }
  await domain.removeLeaveRequest(id);
  return c.json(successBody(null, 'Permohonan cuti dihapus'), 200);
};

export const approveAdmin: AppRouteHandler<routes.ApproveAdminRoute> = async (c) => {
  const id = Number(c.req.param('id'));
  const body = c.req.valid('json');
  const result = await domain.decideAdmin(id, { ...body, actorId: Number(actor(c).id) });
  return c.json(successBody(result, 'Keputusan admin tersimpan'), 200);
};

export const approveLevel: AppRouteHandler<routes.ApproveLevelRoute> = async (c) => {
  const id = Number(c.req.param('id'));
  const level = Number(c.req.param('level'));
  const body = c.req.valid('json');
  const user = actor(c);

  // NIP tidak ikut di dalam token, jadi dibaca dari database: legacy mengunci
  // keputusan atasan per NIP (`tsm.nip_atasan` / `tsm.nip_atasan2`), dan
  // pencocokan itu mustahil tanpa NIP pemutus.
  const nip = await domain.getActorNip(Number(user.id));

  const result = await domain.decideApprover(id, level as 1 | 2, {
    ...body,
    actorId: Number(user.id),
    actor: { actorId: Number(user.id), role: user.role, nip },
  });
  return c.json(successBody(result, 'Keputusan atasan tersimpan'), 200);
};

export const cancelLeave: AppRouteHandler<routes.CancelLeaveRoute> = async (c) => {
  const id = Number(c.req.param('id'));
  const body = c.req.valid('json');
  const result = await domain.cancelLeaveRequest(id, Number(actor(c).id), body.note);
  return c.json(successBody(result, 'Permohonan cuti dibatalkan'), 200);
};

// ---------------------------------------------------------------------------
// Riwayat cuti lama
// ---------------------------------------------------------------------------

export const leaveLegacyHistory: AppRouteHandler<routes.LeaveLegacyHistoryRoute> = async (c) => {
  const query = c.req.valid('query');
  const user = actor(c);
  // Role admin tidak memiliki riwayat cuti pribadi
  if (user.role === 'admin' && !query.user_id) {
    return c.json(successBody([], 'Riwayat cuti pra-2020'), 200);
  }
  const userId = query.user_id ?? (canSeeAll(user.role) ? undefined : Number(user.id));
  const history = await domain.getLeaveLegacyHistory({ userId, year: query.year });
  return c.json(successBody(history as Array<Record<string, unknown>>, 'Riwayat cuti pra-2020'), 200);
};

