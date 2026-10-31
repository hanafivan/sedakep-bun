/**
 * Tipe internal modul layanan kepegawaian (service requests).
 * Satu tabel generik `service_requests` + nilai spesifik per jenis di
 * `service_request_fields`, dokumen di `service_documents`, verifikasi di
 * `service_request_checks`, dan surat terbit di `generated_letters`.
 */

export type ServiceStatus = 'submitted' | 'in_review' | 'approved' | 'rejected' | 'cancelled';
export type ServiceDecision = 'pending' | 'accepted' | 'rejected' | 'cancelled';
export type ServiceApproval = 'pending' | 'accepted' | 'rejected';

export type ServiceRequestRow = {
  id: number;
  legacy_table: string;
  legacy_id: string | null;
  service_type: string;
  user_id: number;
  name: string;
  nip: string | null;
  grade: string | null;
  position: string | null;
  organization_name: string | null;
  phone: string | null;
  title: string | null;
  campus: string | null;
  faculty: string | null;
  major: string | null;
  subtype: string | null;
  approver_1_name: string | null;
  approver_1_nip: string | null;
  approver_1_position: string | null;
  status: ServiceStatus;
  decision: ServiceDecision;
  approver_1_status: ServiceApproval;
  decided_by: number | null;
  decided_at: string | null;
  decision_note: string | null;
  printed_at: string | null;
  anomaly_flag: string | null;
  created_at: string;
  updated_at: string;
};

export type ServiceFieldRow = {
  id: number;
  request_id: number;
  field_key: string;
  field_value: string | null;
};

export type ServiceDocumentRow = {
  id: number;
  request_id: number;
  label: string;
  legacy_field: string | null;
  document_id: number | null;
  legacy_path: string | null;
};

export type ServiceCheckRow = {
  id: number;
  request_id: number;
  check_type: string;
  result: string | null;
  notes: string | null;
  checked_by: number | null;
  checked_at: string | null;
};

export type GeneratedLetterRow = {
  id: number;
  letter_type: string;
  entity_table: string;
  entity_id: number;
  number: string | null;
  document_id: number | null;
  issued_at: string | null;
};
