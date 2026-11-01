import { badRequest, forbidden, notFound } from '../../../shared/errors';
import { insertAuditLog, updateLeaveDecision } from '../command';
import { findLeaveRequestById } from '../query';
import { rebuildQuota } from './quota.domain';
import type { LeaveRequestRow } from '../schema/types';

/**
 * Service persetujuan cuti berjenjang (approval workflow).
 *
 * Mengelola state machine permohonan cuti:
 * - Admin decision (pemeriksaan berkas & pencatatan kuota manual legacy)
 * - Approver 1 (Atasan Langsung)
 * - Approver 2 (Pejabat Berwenang Memberikan Cuti)
 * - Pembatalan permohonan
 *
 * Tidak ada SQL di file ini; mutasi lewat command dan pembacaan lewat query.
 */

const yearOf = (value: string | Date): number => Number(String(value).slice(0, 4));

export type DecisionInput = {
  actorId: number;
  note?: string;
  /** Sisa cuti manual yang dicatat admin (legacy `tahunan_n*`). */
  quota_n?: number;
  quota_n1?: number;
  quota_n2?: number;
  note_n?: string;
  note_n1?: string;
  note_n2?: string;
};

/** Kolom sisa-cuti manual; hanya ditulis kalau admin benar-benar mengisinya. */
const manualQuotaColumns = (input: DecisionInput) => ({
  ...(input.quota_n !== undefined ? { legacy_quota_n: input.quota_n } : {}),
  ...(input.quota_n1 !== undefined ? { legacy_quota_n1: input.quota_n1 } : {}),
  ...(input.quota_n2 !== undefined ? { legacy_quota_n2: input.quota_n2 } : {}),
  ...(input.note_n !== undefined ? { legacy_note_n: input.note_n } : {}),
  ...(input.note_n1 !== undefined ? { legacy_note_n1: input.note_n1 } : {}),
  ...(input.note_n2 !== undefined ? { legacy_note_n2: input.note_n2 } : {}),
});

/**
 * Apakah aktor berhak memutuskan di level ini?
 *
 * Legacy mengunci ini per NIP: `acc_atasan1.php` memfilter
 * `tsm.nip_atasan = $_SESSION['nip']` dan `acc_atasan2.php` memakai
 * `tsm.nip_atasan2`. Tanpa pemeriksaan itu, penunjukan atasan pada formulir
 * hanya jadi hiasan — siapa pun ber-role atasan bisa memutuskan permohonan
 * siapa pun. Admin tetap boleh memutuskan semuanya (legacy: `id_user = 1`).
 */
export const assertApproverAssignment = (
  request: LeaveRequestRow,
  level: 1 | 2,
  actor: { actorId: number; role?: string; nip?: string | null },
): void => {
  if (actor.role === 'admin') return;

  const assignedNip = level === 1 ? request.approver_1_nip : request.approver_2_nip;
  const assignedName = level === 1 ? request.approver_1_name : request.approver_2_name;

  // Permohonan lama (hasil migrasi) bisa belum punya NIP atasan; yang tersisa
  // hanya nama. Dalam hal itu pembatasan tidak bisa ditegakkan dan keputusan
  // diserahkan ke pemeriksaan peran, bukan ditolak tanpa jalan keluar.
  if (!assignedNip) return;

  if (!actor.nip || actor.nip !== assignedNip) {
    throw forbidden(
      `Permohonan ini ditugaskan kepada atasan ${level} dengan NIP ${assignedNip}${
        assignedName ? ` (${assignedName})` : ''
      }; Anda tidak berhak memutuskan.`,
    );
  }
};

/** Status akhir diturunkan dari kombinasi keputusan; bukan mutasi kuota manual. */
const deriveStatus = (
  adminDecision: string,
  approver1: string,
  approver2: string,
): LeaveRequestRow['status'] => {
  if (adminDecision === 'cancelled' || approver1 === 'cancelled' || approver2 === 'cancelled') {
    return 'cancelled';
  }
  if (
    adminDecision === 'rejected' ||
    approver1 === 'rejected' ||
    approver2 === 'rejected'
  ) {
    return 'rejected';
  }
  if (adminDecision === 'accepted' && approver1 === 'accepted' && approver2 === 'accepted') {
    return 'approved';
  }
  return 'in_review';
};

const nowStamp = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

/** Approval admin (level 1 pada legacy) dengan rebuild projection setelahnya. */
export const decideAdmin = async (
  id: number,
  input: DecisionInput & { decision: 'accepted' | 'rejected' | 'cancelled' },
) => {
  const request = await findLeaveRequestById(id);
  if (!request) throw notFound('Permohonan cuti tidak ditemukan');

  const before = {
    status: request.status,
    admin_decision: request.admin_decision,
    approver_1_status: request.approver_1_status,
    approver_2_status: request.approver_2_status,
  };
  const status = deriveStatus(input.decision, request.approver_1_status, request.approver_2_status);

  await updateLeaveDecision(id, {
    admin_decision: input.decision,
    admin_decided_by: input.actorId > 0 ? input.actorId : null,
    admin_decided_at: nowStamp(),
    status,
    rejection_reason: input.decision === 'rejected' ? (input.note ?? null) : request.rejection_reason,
    ...manualQuotaColumns(input),
  });

  await insertAuditLog({
    actor_id: input.actorId > 0 ? input.actorId : null,
    action: `leave_admin_${input.decision}`,
    entity_table: 'leave_requests',
    entity_id: id,
    before_data: before,
    after_data: {
      status,
      admin_decision: input.decision,
      note: input.note ?? null,
      quota_n: input.quota_n ?? null,
      quota_n1: input.quota_n1 ?? null,
      quota_n2: input.quota_n2 ?? null,
    },
  });

  await rebuildQuota(request.user_id, yearOf(request.start_date), input.actorId);
  return { id, status };
};

export const decideApprover = async (
  id: number,
  level: 1 | 2,
  input: DecisionInput & {
    decision: 'accepted' | 'rejected';
    /** Identitas pemutus; dipakai untuk mencocokkan NIP atasan yang ditunjuk. */
    actor: { actorId: number; role?: string; nip?: string | null };
  },
) => {
  const request = await findLeaveRequestById(id);
  if (!request) throw notFound('Permohonan cuti tidak ditemukan');

  await assertApproverAssignment(request, level, input.actor);

  if (level === 2 && request.approver_1_status !== 'accepted') {
    throw badRequest('Approval atasan 1 harus selesai lebih dulu');
  }

  // Legacy mengunci level 1 begitu atasan 2 sudah mengisi (`edit_acc_atasan1.php`
  // menolak kalau `acc_atasan2` tidak kosong) supaya urutannya tidak dibalik.
  if (level === 1 && request.approver_2_status !== 'pending') {
    throw badRequest('Keputusan atasan 1 terkunci karena atasan 2 sudah memutuskan');
  }

  const existingDecision = level === 1 ? request.approver_1_status : request.approver_2_status;
  if (existingDecision === input.decision) {
    // Idempotent: keputusan yang sama tidak diulang, perubahan lain dibatalkan.
    return { id, status: request.status, repeated: true };
  }

  const before = {
    status: request.status,
    approver_1_status: request.approver_1_status,
    approver_2_status: request.approver_2_status,
  };
  const nextApprover1: string = level === 1 ? input.decision : request.approver_1_status;
  const nextApprover2: string = level === 2 ? input.decision : request.approver_2_status;
  const status = deriveStatus(request.admin_decision, nextApprover1, nextApprover2);

  await updateLeaveDecision(id, {
    ...(level === 1
      ? {
          approver_1_status: input.decision,
          approver_1_id: input.actorId > 0 ? input.actorId : null,
          approver_1_decided_at: nowStamp(),
        }
      : {
          approver_2_status: input.decision,
          approver_2_id: input.actorId > 0 ? input.actorId : null,
          approver_2_decided_at: nowStamp(),
        }),
    status,
    ...(input.decision === 'rejected' && input.note ? { rejection_reason: input.note } : {}),
  });

  await insertAuditLog({
    actor_id: input.actorId > 0 ? input.actorId : null,
    action: `leave_approver_${level}_${input.decision}`,
    entity_table: 'leave_requests',
    entity_id: id,
    before_data: before,
    after_data: { status, level, decision: input.decision, note: input.note ?? null },
  });

  await rebuildQuota(request.user_id, yearOf(request.start_date), input.actorId);
  return { id, status };
};

export const cancelLeaveRequest = async (id: number, actorId: number, note?: string) => {
  const request = await findLeaveRequestById(id);
  if (!request) throw notFound('Permohonan cuti tidak ditemukan');

  if (request.status === 'cancelled') {
    return { id, status: 'cancelled' as const, repeated: true };
  }

  await updateLeaveDecision(id, {
    admin_decision: 'cancelled',
    status: 'cancelled',
    rejection_reason: note ?? 'Dibatalkan',
  });

  await insertAuditLog({
    actor_id: actorId > 0 ? actorId : null,
    action: 'leave_cancel',
    entity_table: 'leave_requests',
    entity_id: id,
    before_data: { status: request.status },
    after_data: { status: 'cancelled', note: note ?? null },
  });

  await rebuildQuota(request.user_id, yearOf(request.start_date), actorId);
  return { id, status: 'cancelled' as const };
};

