/**
 * Tipe internal modul surat tugas: bentuk row database.
 * Padanan legacy: `hlm_surtug`, `hlm_surtug_peg`, `hlm_surtug_ket`,
 * `hlm_surtug_tembus`, dan `hlm_surtug_acc` (approval dilipat ke entity).
 */

export type AssignmentStatus = 'submitted' | 'in_review' | 'approved' | 'rejected' | 'cancelled';
export type AssignmentDecision = 'pending' | 'accepted' | 'rejected';

export type AssignmentLetterRow = {
  id: number;
  legacy_id: string | null;
  user_id: number;
  code: string | null;
  letter_number: string | null;
  consideration: string | null;
  legal_basis: string | null;
  content: string | null;
  start_date: string | null;
  end_date: string | null;
  day_start: string | null;
  day_end: string | null;
  place: string | null;
  time_start: string | null;
  time_end: string | null;
  signer_name: string | null;
  signer_position: string | null;
  footnote: string | null;
  printed_at: string | null;
  status: AssignmentStatus;
  decision: AssignmentDecision;
  decided_by: number | null;
  decided_at: string | null;
  decision_note: string | null;
  anomaly_flag: string | null;
  created_at: string;
  updated_at: string;
};

export type AssignmentMemberRow = {
  id: number;
  legacy_id: string | null;
  letter_id: number;
  name: string;
  nip: string | null;
  grade: string | null;
  position: string | null;
  organization_name: string | null;
  sort_order: number;
  created_at: string;
};

export type AssignmentNoteRow = {
  id: number;
  legacy_id: string | null;
  letter_id: number;
  note: string;
  sort_order: number;
  created_at: string;
};

export type AssignmentCopyRow = {
  id: number;
  legacy_id: string | null;
  letter_id: number;
  copy_to: string;
  sort_order: number;
  created_at: string;
};
