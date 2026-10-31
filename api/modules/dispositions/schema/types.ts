/**
 * Tipe internal modul disposisi (surat masuk umum). Padanan legacy:
 * `hlm_edispo`, `hlm_edispo_disposisi`, `hlm_edispo_final`,
 * `hlm_edispo_klasifikasi`, dan referensi surat.
 */

export type IncomingLetterStatus = 'baru' | 'didisposisi' | 'selesai' | 'arsip';
export type DispositionStatus = 'pending' | 'accepted' | 'done' | 'rejected';

export type IncomingLetterRow = {
  id: number;
  legacy_id: string | null;
  created_by: number | null;
  owner_name: string | null;
  owner_nip: string | null;
  agenda_number: string | null;
  ticket_number: string | null;
  letter_number: string | null;
  origin: string | null;
  content: string | null;
  classification_code: string | null;
  index_code: string | null;
  letter_date: string | null;
  received_date: string | null;
  notes: string | null;
  status: IncomingLetterStatus;
  finalized_at: string | null;
  anomaly_flag: string | null;
  created_at: string;
  updated_at: string;
};

export type DispositionRow = {
  id: number;
  legacy_id: string | null;
  incoming_letter_id: number;
  target_name: string | null;
  target_nip: string | null;
  instruction: string | null;
  notes: string | null;
  sort_order: number;
  status: DispositionStatus;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DispositionFinalRow = {
  id: number;
  legacy_id: string | null;
  incoming_letter_id: number;
  name: string | null;
  nip: string | null;
  instruction: string | null;
  created_at: string;
};

export type IncomingLetterRefRow = {
  id: number;
  incoming_letter_id: number;
  reference_text: string | null;
  created_at: string;
};

export type LetterClassificationRow = {
  id: number;
  legacy_id: string | null;
  code: string;
  name: string;
  description: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
};
