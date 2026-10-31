/**
 * Klien API.
 *
 * Satu tempat yang memegang fetch, header Authorization, dan penyimpanan token.
 * Tidak ada komponen yang memanggil fetch langsung.
 */

export type ApiResponse<T> = {
  success: boolean;
  data: T;
  message: string;
  code: number;
  details?: unknown;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type User = {
  id: number;
  username: string;
  name: string;
  nip: string | null;
  grade: string | null;
  role: 'pegawai' | 'verifikator' | 'atasan' | 'admin';
  organization_id: number | null;
  employment_type: string;
  is_active: boolean;
  created_at: string;
};

export type LoginResult = { token: string; user: User };

export type LeaveRequest = {
  id: number;
  user_id: number;
  name: string;
  nip: string | null;
  leave_type: string;
  duration: number;
  duration_unit: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: string;
  admin_decision: string;
  approver_1_status: string;
  approver_2_status: string;
  rejection_reason: string | null;
  letter_number?: string | null;
  letter_document_id?: number | null;
  attachment_document_id?: number | null;
  attachment_filename?: string | null;
  submitted_at?: string;
  created_at?: string;
};

export type LeaveRequestList = {
  items: LeaveRequest[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
};

export type QuotaBucket = { n: number; n1: number; n2: number; total: number };

export type Quota = {
  year: number;
  official: QuotaBucket;
  reserved_days: number;
  reserved_count: number;
  available: QuotaBucket;
  eligibility: {
    eligible: boolean;
    reason: string;
    months_worked: number;
    is_pppk: boolean;
    manual_validation: boolean;
  };
};

export type StoredQuota = {
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

export type QuotaAudit = {
  id: number;
  action: string;
  year: number | null;
  difference: number | null;
  reason: string | null;
  created_at: string;
};

export type DocumentItem = {
  id: number;
  original_filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  status: string;
  created_at: string;
};

export type DownloadUrl = { url: string; filename: string; expires_at: string };

const TOKEN_KEY = 'sedakep.token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string) => {
  localStorage.setItem(TOKEN_KEY, token);
  if (typeof document !== 'undefined') {
    document.cookie = `token=${encodeURIComponent(token)}; path=/; SameSite=Lax`;
  }
};
export const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  if (typeof document !== 'undefined') {
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
  }
};

const buildQuery = (params: Record<string, string | number | undefined | null>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
};

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  // Hanya body string yang JSON. FormData harus menetapkan sendiri
  // `multipart/form-data; boundary=…`; kalau dipaksa application/json, server
  // mencoba membaca multipart sebagai JSON dan menjawab 500.
  if (typeof options.body === 'string') headers.set('Content-Type', 'application/json');

  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(path, { ...options, headers });

  let body: ApiResponse<T> | null = null;
  try {
    body = (await response.json()) as ApiResponse<T>;
  } catch {
    body = null;
  }

  if (response.status === 401) {
    clearToken();
  }

  if (!response.ok || !body?.success) {
    throw new ApiError(
      body?.message ?? `Permintaan gagal (${response.status})`,
      response.status,
      body?.details,
    );
  }

  return body.data;
}

// ---------------------------------------------------------------- auth

export const login = (username: string, password: string) =>
  request<LoginResult>('/api/v1/users/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });

export const me = () => request<User>('/api/v1/users/me');

export const updateMe = (payload: {
  name?: string;
  nip?: string;
  grade?: string;
  email?: string;
  phone?: string;
}) =>
  request<User>('/api/v1/users/me', { method: 'PATCH', body: JSON.stringify(payload) });

export const changePassword = (current_password: string, new_password: string) =>
  request<null>('/api/v1/users/me/password', {
    method: 'POST',
    body: JSON.stringify({ current_password, new_password }),
  });

// ---------------------------------------------------------------- admin pengguna

export type UserUpdatePayload = {
  name?: string;
  nip?: string;
  grade?: string;
  email?: string;
  phone?: string;
  role?: 'pegawai' | 'verifikator' | 'atasan' | 'admin';
  organization_id?: number | null;
  position_id?: number | null;
  is_active?: boolean;
};

export const listUsers = (
  params: { search?: string; role?: string; is_active?: string; page?: number; per_page?: number } = {},
) =>
  request<{
    items: User[];
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
  }>(`/api/v1/users${buildQuery(params)}`);

export const getUser = (id: number) => request<User>(`/api/v1/users/${id}`);

export const updateUser = (id: number, payload: UserUpdatePayload) =>
  request<User>(`/api/v1/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });

export const resetUserPassword = (id: number, new_password: string) =>
  request<null>(`/api/v1/users/${id}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ new_password }),
  });

export const registerUser = (payload: {
  username: string;
  password: string;
  name?: string;
  nip?: string;
  role?: 'pegawai' | 'verifikator' | 'atasan' | 'admin';
}) =>
  request<null>('/api/v1/users/register', { method: 'POST', body: JSON.stringify(payload) });

// ---------------------------------------------------------------- cuti

export const listLeaveRequests = (params: {
  status?: string;
  admin_decision?: string;
  leave_type?: string;
  year?: number;
  search?: string;
  /** Arsip "Sudah/Belum ada SK" (legacy `sk_status`). */
  letter_status?: 'with' | 'without';
  file_status?: 'with' | 'without';
  archive?: 'all' | 'belum_diperiksa' | 'belum_kirim' | 'sk_belum_upload' | 'cuti_jadi' | 'ditolak' | 'dibatalkan';
  page?: number;
  per_page?: number;
  user_id?: number;
}) => request<LeaveRequestList>(`/api/v1/leave-requests${buildQuery(params)}`);

export const getLeaveRequest = (id: number) =>
  request<LeaveRequest & Record<string, unknown>>(`/api/v1/leave-requests/${id}`);

/** Detail lengkap untuk halaman detail/cetak (surat keterangan + kop instansi). */
export type LeaveRequestDetail = LeaveRequest &
  Record<string, unknown> & {
    letters: LeaveLetter[];
    attachments: DocumentItem[];
    instance: Record<string, string | null>;
    verify_code: string;
  };

export const getLeaveRequestDetail = (id: number) =>
  request<LeaveRequestDetail>(`/api/v1/leave-requests/${id}`);

export type CreateLeavePayload = {
  leave_type: string;
  duration: number;
  duration_unit: string;
  start_date: string;
  end_date: string;
  reason?: string;
  address?: string;
  phone?: string;
  approver_1_name?: string;
  approver_1_nip?: string;
  approver_1_position?: string;
  approver_2_name?: string;
  approver_2_nip?: string;
  approver_2_position?: string;
};

export const createLeaveRequest = (payload: CreateLeavePayload) =>
  request<{ id: number; attachment_id: number | null }>('/api/v1/leave-requests', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

/**
 * Pengajuan dengan lampiran. Dikirim sebagai multipart supaya server dapat
 * memvalidasi kewajiban lampiran per jenis cuti dalam satu panggilan — kalau
 * dipisah, permohonan wajib-bukti bisa sempat tersimpan tanpa berkas.
 */
export const createLeaveRequestWithAttachment = (payload: CreateLeavePayload, file: File) => {
  const form = new FormData();
  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined && value !== null && value !== '') form.set(key, String(value));
  }
  form.set('file', file);
  return request<{ id: number; attachment_id: number | null }>('/api/v1/leave-requests', {
    method: 'POST',
    body: form,
  });
};

export type AdminQuotaDecision = {
  quota_n?: number;
  quota_n1?: number;
  quota_n2?: number;
  note_n?: string;
  note_n1?: string;
  note_n2?: string;
};

export const decideAdmin = (
  id: number,
  decision: 'accepted' | 'rejected',
  note?: string,
  quota?: AdminQuotaDecision,
) =>
  request<{ id: number; status: string }>(`/api/v1/leave-requests/${id}/approve/admin`, {
    method: 'POST',
    body: JSON.stringify({ decision, note, ...quota }),
  });

export const decideApprover = (
  id: number,
  level: 1 | 2,
  decision: 'accepted' | 'rejected',
  note?: string,
) =>
  request<{ id: number; status: string }>(
    `/api/v1/leave-requests/${id}/approve/level/${level}`,
    { method: 'POST', body: JSON.stringify({ decision, note }) },
  );

export const cancelLeaveRequest = (id: number, note?: string) =>
  request<{ id: number }>(`/api/v1/leave-requests/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  });

export const updateLeaveRequest = (id: number, payload: Partial<CreateLeavePayload>) =>
  request<{ id: number }>(`/api/v1/leave-requests/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

// ---------------------------------------------------------------- kuota

export const getQuota = (year?: number) =>
  request<Quota>(`/api/v1/leave/quota/me${buildQuery({ year })}`);

export const getStoredQuotas = (userId: number | 'me' = 'me') =>
  request<StoredQuota[]>(`/api/v1/leave/quota/stored/${userId}`);

export type QuotaBookPrint = {
  user: { id: number; name: string; nip: string | null; unit_name: string | null };
  stored: StoredQuota[];
  instance: Record<string, string | null>;
};

export const getQuotaBookPrint = (userId: number | 'me') =>
  request<QuotaBookPrint>(`/api/v1/leave/quota/book/${userId}`);

export const getQuotaHistory = (userId: number | 'me' = 'me', year?: number) =>
  request<QuotaAudit[]>(`/api/v1/leave/quota/history/${userId}${buildQuery({ year })}`);

export const rebuildQuota = (payload: { year: number; user_id?: number; all_users?: boolean }) =>
  request<Record<string, unknown>>('/api/v1/leave/quota/rebuild/me', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

/** Kuota satu pegawai; `me` untuk pemilik token, angka untuk halaman admin. */
export const getQuotaFor = (userId: number | 'me', year?: number) =>
  request<Quota>(`/api/v1/leave/quota/${userId}${buildQuery({ year })}`);

export const rebuildQuotaFor = (userId: number | 'me', year: number) =>
  request<Record<string, unknown>>(`/api/v1/leave/quota/rebuild/${userId}`, {
    method: 'POST',
    body: JSON.stringify({ year, user_id: userId === 'me' ? undefined : userId }),
  });

// ---------------------------------------------------------------- dokumen

export const listEntityDocuments = (entityTable: string, entityId: number) =>
  request<DocumentItem[]>(
    `/api/v1/documents${buildQuery({ entity_table: entityTable, entity_id: entityId })}`,
  );

export const listUnlinkedDocuments = () =>
  request<DocumentItem[]>('/api/v1/documents/unlinked');

export const getDownloadUrl = (id: number) =>
  request<DownloadUrl>(`/api/v1/documents/${id}/download`);

/** Unggah berkas apa pun sebagai lampiran satu entitas. */
export const uploadDocument = (
  entityTable: string,
  entityId: number,
  file: File,
  field = 'attachment',
  label?: string,
) => {
  const form = new FormData();
  form.set('file', file);
  form.set('entity_table', entityTable);
  form.set('entity_id', String(entityId));
  form.set('field', field);
  if (label) form.set('label', label);
  return request<{ id: number; original_filename: string }>('/api/v1/documents', {
    method: 'POST',
    body: form,
  });
};

// ---------------------------------------------------------------- jenis & arsip

export type LeaveTypeOption = {
  name: string;
  units: string[];
  max_days: number;
  consumes_quota: boolean;
  requires_attachment: boolean;
  subject_to_closure: boolean;
  description: string;
};

export const getLeaveTypeOptions = () =>
  request<{ is_pppk: boolean; types: LeaveTypeOption[] }>('/api/v1/leave/types/me');

export type LeaveStatistics = {
  by_status: Array<{ key: string; total: number; days: string | number }>;
  by_type: Array<{ key: string; total: number; days: string | number }>;
  by_archive?: {
    belum_diperiksa: number;
    belum_kirim: number;
    sk_belum_upload: number;
    cuti_jadi: number;
    ditolak: number;
    dibatalkan: number;
    total: number;
  };
};

export const getLeaveStatistics = (params: { year?: number } = {}) =>
  request<LeaveStatistics>(`/api/v1/leave-requests/statistics${buildQuery(params)}`);

/** Rekap tahunan dasbor admin (legacy `admin.php:240-265`). */
export type LeaveYearlySummary = {
  year: number;
  submitted: number;
  approved: number;
  rejected: number;
  cancelled: number;
  total: number;
};

export const getLeaveYearlySummary = () =>
  request<LeaveYearlySummary[]>('/api/v1/leave/admin/yearly-summary');

/** Riwayat cuti pra-2020 hasil migrasi `tbl_n2019`. */
export type LeaveLegacyHistoryRow = {
  user_id: number;
  year: number;
  leave_type: string;
  duration: number;
  duration_unit: string;
  start_date: string | null;
  end_date: string | null;
  number: string | null;
  issued_at: string | null;
};

export const getLeaveLegacyHistory = (params: { user_id?: number; year?: number } = {}) =>
  request<LeaveLegacyHistoryRow[]>(`/api/v1/leave/legacy-history${buildQuery(params)}`);

export type LeaveExportParams = {
  date_from?: string;
  date_to?: string;
  leave_type?: string;
  status?: string;
  letter_status?: 'with' | 'without';
  search?: string;
};

/**
 * Unduh ekspor CSV. `request()` selalu mem-parse JSON, jadi unduhan berkas
 * butuh jalur sendiri: ambil blob, buat object URL, klik anchor sementara.
 */
export const downloadLeaveExport = async (params: LeaveExportParams = {}): Promise<void> => {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`/api/v1/leave/admin/export${buildQuery(params)}`, { headers });
  if (!response.ok) {
    let message = `Ekspor gagal (${response.status})`;
    try {
      const body = (await response.json()) as { message?: string };
      if (body?.message) message = body.message;
    } catch {
      // berkas gagal tanpa body JSON — pesan status sudah cukup
    }
    throw new ApiError(message, response.status);
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const match = disposition.match(/filename=([^;]+)/);
  const filename = match?.[1]?.trim() ?? 'permohonan_cuti.csv';

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

// ---------------------------------------------------------------- surat keterangan

export type LeaveLetter = {
  id: number;
  leave_request_id: number;
  letter_type: 'suket' | 'suket_madrasah';
  number: string | null;
  issued_at: string | null;
  official_name: string | null;
  official_position: string | null;
  document_id: number | null;
  name?: string;
  nip?: string | null;
  leave_type?: string;
};

export const listLetters = (params: { letter_type?: string; search?: string; page?: number; per_page?: number } = {}) =>
  request<{ items: LeaveLetter[]; page: number; per_page: number }>(
    `/api/v1/leave/letters${buildQuery(params)}`,
  );

export const getRequestLetters = (id: number) =>
  request<LeaveLetter[]>(`/api/v1/leave-requests/${id}/letters`);

export const issueLetter = (
  leaveRequestId: number,
  payload: {
    letter_type?: 'suket' | 'suket_madrasah';
    number?: string;
    issued_at?: string;
    official_name?: string;
    official_position?: string;
    file?: File;
  },
) => {
  const form = new FormData();
  if (payload.letter_type) form.set('letter_type', payload.letter_type);
  if (payload.number) form.set('number', payload.number);
  if (payload.issued_at) form.set('issued_at', payload.issued_at);
  if (payload.official_name) form.set('official_name', payload.official_name);
  if (payload.official_position) form.set('official_position', payload.official_position);
  if (payload.file) form.set('file', payload.file);
  return request<{ id: number; number: string; document_id: number | null }>(
    `/api/v1/leave-requests/${leaveRequestId}/letters`,
    { method: 'POST', body: form },
  );
};

export const uploadLetterFile = (letterId: number, file: File) => {
  const form = new FormData();
  form.set('file', file);
  return request<{ id: number; document_id: number }>(`/api/v1/leave/letters/${letterId}/file`, {
    method: 'POST',
    body: form,
  });
};

export const revokeLetter = (leaveRequestId: number, letterType: 'suket' | 'suket_madrasah') =>
  request<null>(`/api/v1/leave-requests/${leaveRequestId}/letters/${letterType}`, {
    method: 'DELETE',
  });

// ---------------------------------------------------------------- admin cuti

export type InstanceProfile = {
  name?: string;
  address?: string;
  logo?: string;
  website?: string;
  email?: string;
  status?: string;
  head_name?: string;
  head_nip?: string;
};

export const getInstanceProfile = () => request<InstanceProfile>('/api/v1/leave/admin/instance');

export const updateInstanceProfile = (payload: InstanceProfile) =>
  request<InstanceProfile>('/api/v1/leave/admin/instance', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

export type ClosurePeriod = {
  id: number;
  year: number;
  start_date: string;
  end_date: string;
  enabled: number;
  message: string | null;
};

export const listClosurePeriods = () =>
  request<ClosurePeriod[]>('/api/v1/leave/admin/closure-periods');

export const createClosurePeriod = (payload: {
  year: number;
  start_date: string;
  end_date: string;
  enabled?: boolean;
  message?: string;
}) =>
  request<{ id: number }>('/api/v1/leave/admin/closure-periods', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const updateClosurePeriod = (
  id: number,
  payload: {
    year?: number;
    start_date?: string;
    end_date?: string;
    enabled?: boolean;
    message?: string | null;
  },
) =>
  request<{ id: number }>(`/api/v1/leave/admin/closure-periods/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

export const deleteClosurePeriod = (id: number) =>
  request<null>(`/api/v1/leave/admin/closure-periods/${id}`, { method: 'DELETE' });

export type QuotaBookRow = StoredQuota & {
  user_id: number;
  name: string;
  nip: string | null;
  unit_name: string | null;
};

export const getQuotaBook = (params: { year?: number; search?: string; page?: number; per_page?: number } = {}) =>
  request<{ items: QuotaBookRow[]; page: number; per_page: number; year: number }>(
    `/api/v1/leave/admin/quota-book${buildQuery(params)}`,
  );

export type AdminUserRow = {
  id: number;
  name: string;
  nip: string | null;
  unit_name: string | null;
  position_name: string | null;
  is_active: number;
};

export const listAdminUsers = (params: { search?: string; page?: number; per_page?: number } = {}) =>
  request<{ items: AdminUserRow[]; total: number; page: number; per_page: number; total_pages: number }>(
    `/api/v1/leave/admin/users${buildQuery(params)}`,
  );

export type QuotaAuditRow = {
  id: number;
  user_id: number;
  year: number | null;
  action: string;
  difference: number | null;
  reason: string | null;
  created_at: string;
  user_name: string | null;
};

export const getQuotaAuditTrail = (params: { action?: string; year?: number; limit?: number } = {}) =>
  request<QuotaAuditRow[]>(`/api/v1/leave/admin/quota-audit${buildQuery(params)}`);

export type PppkTmtRecorded = { nip: string; tmt_date: string; name: string | null };
export type PppkTmtMissing = { id: number; name: string; nip: string | null; unit_name: string | null };

export const getPppkTmt = () =>
  request<{ recorded: PppkTmtRecorded[]; missing: PppkTmtMissing[] }>('/api/v1/leave/admin/pppk-tmt');

export const setPppkTmt = (nip: string, tmt_date: string | null) =>
  request<{ nip: string; tmt_date: string | null }>('/api/v1/leave/admin/pppk-tmt', {
    method: 'PUT',
    body: JSON.stringify({ nip, tmt_date }),
  });

export const getLeavePolicy = (year?: number) =>
  request<Record<string, unknown>>(`/api/v1/leave/policy${buildQuery({ year })}`);

export const applyLeavePolicy = (payload: {
  year: number;
  default_days: number;
  carry_over_max_n1?: number;
  carry_over_max_n2?: number;
  min_service_months?: number;
  notes?: string;
  confirm?: boolean;
}) =>
  request<Record<string, unknown>>('/api/v1/leave/policy', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

export const rolloverQuota = (year: number) =>
  request<{ year: number; success: number; failed: number }>('/api/v1/leave/quota/rollover', {
    method: 'POST',
    body: JSON.stringify({ year }),
  });

export type QuotaAdjustment = {
  id: number;
  user_id: number;
  year: number;
  days: number;
  reason: string | null;
  created_at: string;
};

export const createQuotaAdjustment = (payload: {
  user_id: number;
  year: number;
  days: number;
  /** Bucket yang dikoreksi: n = tahun berjalan, n1/n2 = jatah bawaan. */
  bucket?: 'n' | 'n1' | 'n2';
  reason?: string;
}) =>
  request<{ id: number; days: number; quota: Quota }>('/api/v1/leave/quota/adjustment', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const listQuotaAdjustments = (userId: number | 'me', year?: number) =>
  request<QuotaAdjustment[]>(
    `/api/v1/leave/quota/adjustment/${userId}${buildQuery({ year })}`,
  );

export const deleteQuotaAdjustment = (id: number, userId: number, year: number) =>
  request<null>(
    `/api/v1/leave/quota/adjustment/${id}${buildQuery({ user_id: userId, year })}`,
    { method: 'DELETE' },
  );

export const setEligibilityOverride = (payload: {
  user_id: number;
  year: number;
  active: boolean;
  reason?: string;
}) =>
  request<Record<string, unknown>>('/api/v1/leave/quota/eligibility-override', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

// ---------------------------------------------------------------- pengaturan

export type SettingRow = {
  key: string;
  value: string | null;
  description: string | null;
  updated_at: string;
  secret: boolean;
  readonly: boolean;
};

export const listSettings = (params?: { prefix?: string; search?: string }) =>
  request<SettingRow[]>(`/api/v1/settings${buildQuery(params ?? {})}`);

export const setSetting = (
  key: string,
  payload: { value: string | null; description?: string | null },
) =>
  request<SettingRow>(`/api/v1/settings/${encodeURIComponent(key)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

export const deleteSetting = (key: string) =>
  request<null>(`/api/v1/settings/${encodeURIComponent(key)}`, { method: 'DELETE' });

// ---------------------------------------------------------------- surat tugas

export type AssignmentLetter = {
  id: number;
  user_id: number;
  name: string;
  nip: string | null;
  code: string | null;
  letter_number: string | null;
  number_display: string | null;
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
  status: string;
  decision: string;
  decision_note: string | null;
  created_at: string;
  updated_at: string;
};

export type AssignmentMember = {
  id: number;
  letter_id: number;
  name: string;
  nip: string | null;
  grade: string | null;
  position: string | null;
  organization_name: string | null;
  sort_order: number;
};

export type AssignmentNote = { id: number; letter_id: number; note: string; sort_order: number };
export type AssignmentCopy = { id: number; letter_id: number; copy_to: string; sort_order: number };

export type AssignmentLetterDetail = AssignmentLetter & {
  members: AssignmentMember[];
  notes: AssignmentNote[];
  copies: AssignmentCopy[];
  documents: DocumentItem[];
  instance: Record<string, string | null>;
  verify_code: string;
};

export type CreateAssignmentPayload = {
  code?: string;
  consideration?: string;
  legal_basis?: string;
  content?: string;
  start_date?: string;
  end_date?: string;
  day_start?: string;
  day_end?: string;
  place?: string;
  time_start?: string;
  time_end?: string;
  signer_name?: string;
  signer_position?: string;
  footnote?: string;
};

export const listAssignmentLetters = (
  params: { status?: string; year?: number; search?: string; page?: number } = {},
) =>
  request<{
    items: AssignmentLetter[];
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
  }>(`/api/v1/assignment-letters${buildQuery(params)}`);

export const getAssignmentLetter = (id: number) =>
  request<AssignmentLetterDetail>(`/api/v1/assignment-letters/${id}`);

export const createAssignmentLetter = (payload: CreateAssignmentPayload) =>
  request<{ id: number; status: string }>('/api/v1/assignment-letters', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const updateAssignmentLetter = (id: number, payload: CreateAssignmentPayload) =>
  request<{ id: number }>(`/api/v1/assignment-letters/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

export const deleteAssignmentLetter = (id: number) =>
  request<null>(`/api/v1/assignment-letters/${id}`, { method: 'DELETE' });

export const cancelAssignmentLetter = (id: number) =>
  request<{ id: number; status: string }>(`/api/v1/assignment-letters/${id}/cancel`, {
    method: 'POST',
  });

export const decideAssignmentLetter = (
  id: number,
  decision: 'accepted' | 'rejected',
  note?: string,
) =>
  request<{ id: number; status: string }>(`/api/v1/assignment-letters/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ decision, note }),
  });

export const setAssignmentNumber = (id: number, letter_number: string) =>
  request<AssignmentLetter>(`/api/v1/assignment-letters/${id}/number`, {
    method: 'POST',
    body: JSON.stringify({ letter_number }),
  });

export const uploadAssignmentFile = (id: number, file: File) => {
  const form = new FormData();
  form.set('file', file);
  return request<{ id: number; document_id: number }>(`/api/v1/assignment-letters/${id}/file`, {
    method: 'POST',
    body: form,
  });
};

export const addAssignmentMember = (
  letterId: number,
  payload: Partial<Omit<AssignmentMember, 'id' | 'letter_id'>> & { name: string },
) =>
  request<{ id: number }>(`/api/v1/assignment-letters/${letterId}/members`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const updateAssignmentMember = (
  letterId: number,
  memberId: number,
  payload: Partial<Omit<AssignmentMember, 'id' | 'letter_id'>>,
) =>
  request<{ id: number }>(`/api/v1/assignment-letters/${letterId}/members/${memberId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

export const deleteAssignmentMember = (letterId: number, memberId: number) =>
  request<null>(`/api/v1/assignment-letters/${letterId}/members/${memberId}`, {
    method: 'DELETE',
  });

export const addAssignmentNote = (letterId: number, note: string) =>
  request<{ id: number }>(`/api/v1/assignment-letters/${letterId}/notes`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  });

export const deleteAssignmentNote = (letterId: number, noteId: number) =>
  request<null>(`/api/v1/assignment-letters/${letterId}/notes/${noteId}`, { method: 'DELETE' });

export const addAssignmentCopy = (letterId: number, copy_to: string) =>
  request<{ id: number }>(`/api/v1/assignment-letters/${letterId}/copies`, {
    method: 'POST',
    body: JSON.stringify({ copy_to }),
  });

export const deleteAssignmentCopy = (letterId: number, copyId: number) =>
  request<null>(`/api/v1/assignment-letters/${letterId}/copies/${copyId}`, { method: 'DELETE' });

// ---------------------------------------------------------------- alibi

export type AlibiRequest = {
  id: number;
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
  status: string;
  admin_decision: string;
  approver_1_status: string;
  approver_2_status: string;
  admin_decided_at: string | null;
  approver_1_decided_at: string | null;
  approver_2_decided_at: string | null;
  verdict_note: string | null;
  printed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AlibiDetail = AlibiRequest & {
  documents: DocumentItem[];
  instance: Record<string, string | null>;
  verify_code: string;
};

export type AlibiPayload = Partial<{
  alibi_type: string;
  alibi_date: string;
  day_count: string;
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

export const listAlibiRequests = (
  params: { status?: string; year?: number; search?: string; page?: number } = {},
) =>
  request<{
    items: AlibiRequest[];
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
  }>(`/api/v1/alibi-requests${buildQuery(params)}`);

export const getAlibiRequest = (id: number) =>
  request<AlibiDetail>(`/api/v1/alibi-requests/${id}`);

export const createAlibiRequest = (payload: AlibiPayload) =>
  request<{ id: number; status: string }>('/api/v1/alibi-requests', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const updateAlibiRequest = (id: number, payload: AlibiPayload) =>
  request<{ id: number }>(`/api/v1/alibi-requests/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

export const deleteAlibiRequest = (id: number) =>
  request<null>(`/api/v1/alibi-requests/${id}`, { method: 'DELETE' });

export const decideAlibiAdmin = (
  id: number,
  decision: 'accepted' | 'rejected' | 'cancelled',
  note?: string,
) =>
  request<{ id: number; status: string }>(`/api/v1/alibi-requests/${id}/approve/admin`, {
    method: 'POST',
    body: JSON.stringify({ decision, note }),
  });

export const decideAlibiApprover = (
  id: number,
  level: 1 | 2,
  decision: 'accepted' | 'rejected',
  note?: string,
) =>
  request<{ id: number; status: string }>(
    `/api/v1/alibi-requests/${id}/approve/level/${level}`,
    { method: 'POST', body: JSON.stringify({ decision, note }) },
  );

export const cancelAlibi = (id: number, note?: string) =>
  request<{ id: number; status: string }>(`/api/v1/alibi-requests/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  });

export const uploadAlibiFile = (id: number, file: File) => {
  const form = new FormData();
  form.set('file', file);
  return request<{ id: number; document_id: number }>(`/api/v1/alibi-requests/${id}/file`, {
    method: 'POST',
    body: form,
  });
};

// ---------------------------------------------------------------- disposisi

export type IncomingLetter = {
  id: number;
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
  status: string;
  finalized_at: string | null;
  disposition_count: number;
  created_at: string;
  updated_at: string;
};

export type Disposition = {
  id: number;
  incoming_letter_id: number;
  target_name: string | null;
  target_nip: string | null;
  instruction: string | null;
  notes: string | null;
  sort_order: number;
  status: string;
  decided_at: string | null;
};

export type DispositionFinal = {
  id: number;
  incoming_letter_id: number;
  name: string | null;
  nip: string | null;
  instruction: string | null;
};

export type IncomingLetterRef = { id: number; incoming_letter_id: number; reference_text: string | null };

export type LetterClassification = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  is_active: number;
};

export type IncomingLetterDetail = IncomingLetter & {
  dispositions: Disposition[];
  finals: DispositionFinal[];
  references: IncomingLetterRef[];
  documents: DocumentItem[];
  instance: Record<string, string | null>;
  verify_code: string;
};

export type IncomingLetterPayload = Partial<{
  owner_name: string;
  owner_nip: string;
  agenda_number: string;
  ticket_number: string;
  letter_number: string;
  origin: string;
  content: string;
  classification_code: string;
  index_code: string;
  letter_date: string;
  received_date: string;
  notes: string;
}>;

export const listIncomingLetters = (
  params: { status?: string; year?: number; search?: string; page?: number } = {},
) =>
  request<{
    items: IncomingLetter[];
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
  }>(`/api/v1/incoming-letters${buildQuery(params)}`);

export const getIncomingLetter = (id: number) =>
  request<IncomingLetterDetail>(`/api/v1/incoming-letters/${id}`);

export const createIncomingLetter = (payload: IncomingLetterPayload) =>
  request<{ id: number; status: string }>('/api/v1/incoming-letters', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const updateIncomingLetter = (id: number, payload: IncomingLetterPayload) =>
  request<{ id: number }>(`/api/v1/incoming-letters/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

export const deleteIncomingLetter = (id: number) =>
  request<null>(`/api/v1/incoming-letters/${id}`, { method: 'DELETE' });

export const finalizeIncomingLetter = (id: number) =>
  request<{ id: number; status: string }>(`/api/v1/incoming-letters/${id}/finalize`, {
    method: 'POST',
  });

export const uploadIncomingLetterFile = (id: number, file: File, field: 'sm' | 'sk' = 'sm') => {
  const form = new FormData();
  form.set('file', file);
  form.set('field', field);
  return request<{ id: number; document_id: number }>(`/api/v1/incoming-letters/${id}/file`, {
    method: 'POST',
    body: form,
  });
};

export const addDisposition = (
  letterId: number,
  payload: { target_name?: string; target_nip?: string; instruction?: string; notes?: string },
) =>
  request<{ id: number }>(`/api/v1/incoming-letters/${letterId}/dispositions`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const updateDisposition = (
  letterId: number,
  dispositionId: number,
  payload: { status?: 'pending' | 'accepted' | 'done' | 'rejected'; instruction?: string; notes?: string },
) =>
  request<{ id: number }>(`/api/v1/incoming-letters/${letterId}/dispositions/${dispositionId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

export const deleteDisposition = (letterId: number, dispositionId: number) =>
  request<null>(`/api/v1/incoming-letters/${letterId}/dispositions/${dispositionId}`, {
    method: 'DELETE',
  });

export const addDispositionFinal = (
  letterId: number,
  payload: { name?: string; nip?: string; instruction?: string },
) =>
  request<{ id: number }>(`/api/v1/incoming-letters/${letterId}/finals`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const deleteDispositionFinal = (letterId: number, finalId: number) =>
  request<null>(`/api/v1/incoming-letters/${letterId}/finals/${finalId}`, { method: 'DELETE' });

export const addIncomingLetterReference = (letterId: number, reference_text: string) =>
  request<{ id: number }>(`/api/v1/incoming-letters/${letterId}/references`, {
    method: 'POST',
    body: JSON.stringify({ reference_text }),
  });

export const deleteIncomingLetterReference = (letterId: number, refId: number) =>
  request<null>(`/api/v1/incoming-letters/${letterId}/references/${refId}`, { method: 'DELETE' });

export const listClassifications = (params: { search?: string; active_only?: string } = {}) =>
  request<LetterClassification[]>(`/api/v1/letter-classifications${buildQuery(params)}`);

export const createClassification = (payload: {
  code: string;
  name: string;
  description?: string;
  is_active?: boolean;
}) =>
  request<{ id: number }>('/api/v1/letter-classifications', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const updateClassification = (
  id: number,
  payload: { code?: string; name?: string; description?: string; is_active?: boolean },
) =>
  request<{ id: number }>(`/api/v1/letter-classifications/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

export const deleteClassification = (id: number) =>
  request<null>(`/api/v1/letter-classifications/${id}`, { method: 'DELETE' });

// ---------------------------------------------------------------- agenda

export type Agenda = {
  id: number;
  user_id: number;
  name: string | null;
  nip: string | null;
  title: string;
  place: string | null;
  start_at: string | null;
  end_at: string | null;
  report: string | null;
  reported_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AgendaDetail = Agenda & {
  documents: DocumentItem[];
  instance: Record<string, string | null>;
};

export type AgendaPayload = Partial<{
  title: string;
  place: string;
  start_at: string;
  end_at: string;
  report: string;
}>;

export const listAgendas = (
  params: { year?: number; month?: number; search?: string; page?: number } = {},
) =>
  request<{
    items: Agenda[];
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
  }>(`/api/v1/agendas${buildQuery(params)}`);

export const getAgenda = (id: number) => request<AgendaDetail>(`/api/v1/agendas/${id}`);

export const createAgenda = (payload: AgendaPayload) =>
  request<{ id: number }>('/api/v1/agendas', { method: 'POST', body: JSON.stringify(payload) });

export const updateAgenda = (id: number, payload: AgendaPayload) =>
  request<{ id: number }>(`/api/v1/agendas/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

export const deleteAgenda = (id: number) =>
  request<null>(`/api/v1/agendas/${id}`, { method: 'DELETE' });

export const setAgendaReport = (id: number, report: string) =>
  request<{ id: number }>(`/api/v1/agendas/${id}/report`, {
    method: 'POST',
    body: JSON.stringify({ report }),
  });

export const uploadAgendaFile = (id: number, file: File) => {
  const form = new FormData();
  form.set('file', file);
  return request<{ id: number; document_id: number }>(`/api/v1/agendas/${id}/file`, {
    method: 'POST',
    body: form,
  });
};

// ---------------------------------------------------------------- layanan kepegawaian

export type ServiceFieldDef = { key: string; label: string; kind: 'text' | 'date' | 'textarea' };
export type ServiceDocDef = { label: string; title: string };
export type ServiceTypeMeta = {
  type: string;
  label: string;
  subtype_label: string | null;
  subtype_options: string[];
  fields: ServiceFieldDef[];
  documents: ServiceDocDef[];
  letters: string[];
};

export type ServiceRequest = {
  id: number;
  service_type: string;
  user_id: number;
  name: string;
  nip: string | null;
  grade: string | null;
  position: string | null;
  organization_name: string | null;
  phone: string | null;
  title: string | null;
  subtype: string | null;
  approver_1_name: string | null;
  approver_1_nip: string | null;
  approver_1_position: string | null;
  status: string;
  decision: string;
  approver_1_status: string;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
  updated_at: string;
};

export type ServiceRequestDetail = ServiceRequest & {
  fields: Record<string, string | null>;
  service_documents: Array<{ id: number; label: string; document_id: number | null }>;
  checks: Array<{ id: number; check_type: string; result: string | null; notes: string | null; checked_at: string | null }>;
  letters: Array<{ id: number; letter_type: string; number: string | null; issued_at: string | null }>;
  documents: DocumentItem[];
  instance: Record<string, string | null>;
};

export type ServiceRequestPayload = Partial<{
  service_type: string;
  title: string;
  phone: string;
  subtype: string;
  approver_1_name: string;
  approver_1_nip: string;
  approver_1_position: string;
  fields: Record<string, string>;
}>;

export const getServiceMeta = () =>
  request<{ types: ServiceTypeMeta[] }>('/api/v1/service-requests/meta');

export const listServiceRequests = (
  params: { service_type?: string; status?: string; search?: string; page?: number } = {},
) =>
  request<{
    items: ServiceRequest[];
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
  }>(`/api/v1/service-requests${buildQuery(params)}`);

export const getServiceRequest = (id: number) =>
  request<ServiceRequestDetail>(`/api/v1/service-requests/${id}`);

export const createServiceRequest = (payload: ServiceRequestPayload) =>
  request<{ id: number; service_type: string }>('/api/v1/service-requests', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const updateServiceRequest = (id: number, payload: ServiceRequestPayload) =>
  request<{ id: number }>(`/api/v1/service-requests/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

export const deleteServiceRequest = (id: number) =>
  request<null>(`/api/v1/service-requests/${id}`, { method: 'DELETE' });

export const approveServiceRequest = (
  id: number,
  decision: 'accepted' | 'rejected' | 'cancelled',
  note?: string,
) =>
  request<{ id: number; status: string }>(`/api/v1/service-requests/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ decision, note }),
  });

export const setServiceFields = (id: number, fields: Record<string, string>) =>
  request<{ id: number }>(`/api/v1/service-requests/${id}/fields`, {
    method: 'POST',
    body: JSON.stringify({ fields }),
  });

export const uploadServiceDocument = (id: number, label: string, file: File) => {
  const form = new FormData();
  form.set('file', file);
  form.set('label', label);
  return request<{ id: number; label: string; document_id: number }>(
    `/api/v1/service-requests/${id}/documents`,
    { method: 'POST', body: form },
  );
};

export const addServiceCheck = (
  id: number,
  payload: { check_type: string; result?: string; notes?: string },
) =>
  request<{ id: number }>(`/api/v1/service-requests/${id}/checks`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const addServiceLetter = (
  id: number,
  payload: { letter_type: 'sphd' | 'sppid' | 'sk' | 'suket'; number?: string; issued_at?: string },
) =>
  request<{ id: number }>(`/api/v1/service-requests/${id}/letters`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

// ---------------------------------------------------------------- PDF & verifikasi (Fase 13)

export type GeneratedPdf = { document_id: number; url: string; verify_url: string };

export const generateAssignmentPdf = (id: number) =>
  request<GeneratedPdf>(`/api/v1/assignment-letters/${id}/pdf`, { method: 'POST' });

export const generateLeavePdf = (id: number) =>
  request<GeneratedPdf>(`/api/v1/leave-requests/${id}/pdf`, { method: 'POST' });

export const generateLeaveFormPdf = (id: number) =>
  request<{ document_id: number; url: string }>(`/api/v1/leave-requests/${id}/form-pdf`, { method: 'POST' });


export const generateServicePdf = (id: number) =>
  request<GeneratedPdf & { letter_id: number }>(`/api/v1/service-requests/${id}/pdf`, {
    method: 'POST',
  });

export type VerifyResult = {
  valid: boolean;
  document: string;
  number?: string | null;
  name?: string;
  status?: string;
  entity?: string;
  entity_id?: number;
  leave_detail?: Record<string, any>;
  instance?: Record<string, any>;
  [key: string]: unknown;
};

export const verifyDocument = (code: string) =>
  request<VerifyResult>(`/api/v1/verify/${encodeURIComponent(code)}`);

// ---------------------------------------------------------------- master data

export type Organization = {
  id: number;
  code: string;
  name: string;
  parent_id: number | null;
  level: number;
  is_active: number;
};

export type Position = { id: number; name: string; grade: string | null; is_active: number };

export const listOrganizations = (params: { search?: string; active_only?: string } = {}) =>
  request<Organization[]>(`/api/v1/organizations${buildQuery(params)}`);

export const createOrganization = (payload: {
  code: string;
  name: string;
  parent_id?: number | null;
  level?: number;
  is_active?: boolean;
}) =>
  request<{ id: number }>('/api/v1/organizations', { method: 'POST', body: JSON.stringify(payload) });

export const updateOrganization = (
  id: number,
  payload: { code?: string; name?: string; parent_id?: number | null; level?: number; is_active?: boolean },
) =>
  request<{ id: number }>(`/api/v1/organizations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

export const deleteOrganization = (id: number) =>
  request<null>(`/api/v1/organizations/${id}`, { method: 'DELETE' });

export const listPositions = (params: { search?: string; active_only?: string } = {}) =>
  request<Position[]>(`/api/v1/positions${buildQuery(params)}`);

export const createPosition = (payload: { name: string; grade?: string; is_active?: boolean }) =>
  request<{ id: number }>('/api/v1/positions', { method: 'POST', body: JSON.stringify(payload) });

export const updatePosition = (
  id: number,
  payload: { name?: string; grade?: string; is_active?: boolean },
) =>
  request<{ id: number }>(`/api/v1/positions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

export const deletePosition = (id: number) =>
  request<null>(`/api/v1/positions/${id}`, { method: 'DELETE' });

// ---------------------------------------------------------------- navigasi & sistem

export type NavigationBadges = {
  disposition_pending: number;
  leave_pending: number;
  quota_remaining_days: number;
};

/** Angka badge sidebar — dari server, bukan hitungan klien. */
export const getNavigationBadges = () =>
  request<NavigationBadges>('/api/v1/navigation/badges');

export type BackupFile = { filename: string; size_bytes: number; created_at: string };
export type BackupResult = { filename: string; size_bytes: number; documents: number };

export const listBackups = () => request<BackupFile[]>('/api/v1/system/backups');

export const createBackup = () =>
  request<BackupResult>('/api/v1/system/backups', { method: 'POST' });

export const restoreBackup = (filename: string) =>
  request<{ filename: string }>('/api/v1/system/backups/restore', {
    method: 'POST',
    body: JSON.stringify({ filename, confirm: 'RESTORE' }),
  });
