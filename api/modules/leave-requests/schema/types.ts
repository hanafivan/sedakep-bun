/**
 * Tipe internal modul cuti: bentuk row database dan tipe gabungan.
 */

export type LeaveRequestRow = {
  id: number;
  legacy_id: string | null;
  user_id: number;
  legacy_user_id: number | null;
  name: string;
  nip: string | null;
  grade: string | null;
  position: string | null;
  organization_name: string | null;
  service_years: string | null;
  leave_type: string;
  duration: number;
  duration_unit: 'day' | 'month' | 'year';
  start_date: string;
  end_date: string;
  reason: string | null;
  address: string | null;
  phone: string | null;
  approver_1_name: string | null;
  approver_1_nip: string | null;
  approver_1_position: string | null;
  approver_2_name: string | null;
  approver_2_nip: string | null;
  approver_2_position: string | null;
  status: 'submitted' | 'in_review' | 'approved' | 'rejected' | 'cancelled';
  admin_decision: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  approver_1_status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  approver_2_status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  admin_decided_by: number | null;
  admin_decided_at: string | null;
  approver_1_id: number | null;
  approver_1_decided_at: string | null;
  approver_2_id: number | null;
  approver_2_decided_at: string | null;
  rejection_reason: string | null;
  legacy_quota_n: number | null;
  legacy_quota_n1: number | null;
  legacy_quota_n2: number | null;
  legacy_note_n: string | null;
  legacy_note_n1: string | null;
  legacy_note_n2: string | null;
  anomaly_flag: string | null;
  submitted_at: string;
  created_at: string;
  updated_at: string;
  attachment_document_id?: number | null;
  attachment_filename?: string | null;
};

export type LeavePolicyRow = {
  id: number;
  year: number;
  default_days: number;
  days_after_sk: number;
  sk_applied: number;
  sk_applied_at: string | null;
  notes: string | null;
  carry_over_max_n1: number;
  carry_over_max_n2: number;
  min_service_months: number;
};

export type LeaveQuotaRow = {
  id: number;
  user_id: number;
  year: number;
  quota_n: number;
  quota_n1: number;
  quota_n2: number;
  total_quota: number;
  used_n: number;
  used_n1: number;
  used_n2: number;
  total_used: number;
  remaining_n: number;
  remaining_n1: number;
  remaining_n2: number;
  total_remaining: number;
  reserved_days: number;
  reserved_count: number;
  eligible: number;
  months_worked: number | null;
  tmt_year: number | null;
  tmt_month: number | null;
  manual_validation: number;
  override_reason: string | null;
  computed_at: string | null;
};

/** Projection tersimpan di leave_quotas (bukan hasil hitung langsung). */
export type StoredQuotaRow = {
  year: number;
  remaining_n: number;
  remaining_n1: number;
  remaining_n2: number;
  total_remaining: number;
  reserved_days: number;
  reserved_count: number;
  eligible: number;
  manual_validation: number;
  computed_at: string | null;
};

export type UserIdentityRow = {
  id: number;
  nip: string | null;
  name: string;
  role: string;
  organization_id: number | null;
  is_active: number;
};

/** Transaksi cuti ringkas yang dibutuhkan engine. */
export type LeaveTransactionRow = {
  id: number;
  leave_type: string;
  duration: number;
  duration_unit: string;
  start_date: string;
  admin_decision: string;
  approver_1_status: string;
  approver_2_status: string;
};

/** Periode tutup pengajuan cuti tahunan. */
export type LeaveClosurePeriodRow = {
  id: number;
  year: number;
  start_date: string;
  end_date: string;
  enabled: number;
  message: string | null;
  created_by: number | null;
  updated_by: number | null;
  created_at: string;
  updated_at: string;
};

/**
 * Surat keterangan cuti.
 * `suket` = surat keterangan biasa (punya nomor), `suket_madrasah` = versi
 * madrasah yang hanya menyimpan berkas SK.
 */
export type LeaveLetterRow = {
  id: number;
  leave_request_id: number;
  letter_type: 'suket' | 'suket_madrasah';
  number: string | null;
  issued_at: string | null;
  official_position: string | null;
  official_name: string | null;
  document_id: number | null;
  legacy_id: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
};
