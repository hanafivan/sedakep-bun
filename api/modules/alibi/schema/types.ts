/**
 * Tipe internal modul alibi. Padanan legacy: `hlm_alibi` + `hlm_alibi_acc`
 * (approval 3 tingkat dilipat ke entity: admin + atasan 1 + atasan 2).
 */

export type AlibiStatus = 'submitted' | 'in_review' | 'approved' | 'rejected' | 'cancelled';
export type AlibiDecision = 'pending' | 'accepted' | 'rejected' | 'cancelled';
export type AlibiApproval = 'pending' | 'accepted' | 'rejected';

export type AlibiRequestRow = {
  id: number;
  legacy_id: string | null;
  user_id: number;
  name: string;
  nip: string | null;
  grade: string | null;
  position: string | null;
  organization_name: string | null;
  day_count: string | null;
  alibi_date: string | null;
  alibi_type: string | null;
  reason: string | null;
  time_start: string | null;
  time_end: string | null;
  approver_1_name: string | null;
  approver_1_nip: string | null;
  approver_1_position: string | null;
  approver_2_name: string | null;
  approver_2_nip: string | null;
  approver_2_position: string | null;
  status: AlibiStatus;
  admin_decision: AlibiDecision;
  approver_1_status: AlibiApproval;
  approver_2_status: AlibiApproval;
  admin_decided_at: string | null;
  approver_1_decided_at: string | null;
  approver_2_decided_at: string | null;
  verdict_note: string | null;
  printed_at: string | null;
  created_at: string;
  updated_at: string;
};
