import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { getMySql } from '../../../db/mysql';
import type {
  LeaveClosurePeriodRow,
  LeaveLetterRow,
  LeavePolicyRow,
  LeaveRequestRow,
  LeaveTransactionRow,
  StoredQuotaRow,
} from '../schema/types';

/**
 * QUERY = operasi baca modul cuti. Semua SELECT modul cuti ada di sini.
 * Tidak ada logika bisnis di file ini.
 */

type Executor = Pool | PoolConnection;

const rows = async <T>(executor: Executor, sql: string, params: unknown[] = []): Promise<T[]> => {
  const [result] = await executor.query<RowDataPacket[]>(sql, params);
  return result as unknown as T[];
};

export const findLeaveRequests = async (
  filter: {
    userId?: number;
    leaveType?: string;
    status?: string;
    adminDecision?: string;
    approverLevel?: 1 | 2;
    approverStatus?: 'pending' | 'accepted' | 'rejected';
    approverNip?: string;
    year?: number;
    search?: string;
    /** 'with' = sudah ada SK, 'without' = belum ada SK (arsip legacy `sk_status`). */
    letterStatus?: 'with' | 'without';
    fileStatus?: 'with' | 'without';
    archive?: 'all' | 'belum_diperiksa' | 'belum_kirim' | 'sk_belum_upload' | 'cuti_jadi' | 'ditolak' | 'dibatalkan';
    limit?: number;
    offset?: number;
  },
  executor: Executor = getMySql(),
): Promise<LeaveRequestRow[]> => {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filter.userId) {
    where.push('r.user_id = ?');
    params.push(filter.userId);
  }
  if (filter.leaveType) {
    where.push('r.leave_type = ?');
    params.push(filter.leaveType);
  }
  if (filter.status) {
    const statuses = filter.status.split(',').map((s) => s.trim()).filter(Boolean);
    if (statuses.length > 1) {
      where.push(`r.status IN (${statuses.map(() => '?').join(', ')})`);
      params.push(...statuses);
    } else if (statuses.length === 1) {
      where.push('r.status = ?');
      params.push(statuses[0]);
    }
  }
  if (filter.adminDecision) {
    where.push('r.admin_decision = ?');
    params.push(filter.adminDecision);
  }
  if (filter.approverLevel === 1) {
    where.push("r.status NOT IN ('rejected', 'cancelled')");
    if (filter.approverStatus) {
      where.push('r.approver_1_status = ?');
      params.push(filter.approverStatus);
    } else {
      where.push("r.approver_1_status = 'pending'");
    }
    if (filter.approverNip) {
      where.push('r.approver_1_nip = ?');
      params.push(filter.approverNip);
    }
  } else if (filter.approverLevel === 2) {
    where.push("r.status NOT IN ('rejected', 'cancelled')");
    if (filter.approverStatus) {
      where.push('r.approver_2_status = ?');
      params.push(filter.approverStatus);
    } else {
      where.push("r.approver_2_status = 'pending'");
    }
    if (filter.approverNip) {
      where.push('r.approver_2_nip = ?');
      params.push(filter.approverNip);
    }
  } else if (filter.approverNip) {
    where.push('(r.approver_1_nip = ? OR r.approver_2_nip = ?)');
    params.push(filter.approverNip, filter.approverNip);
  }
  if (!filter.approverLevel && filter.approverStatus) {
    where.push('(r.approver_1_status = ? OR r.approver_2_status = ?)');
    params.push(filter.approverStatus, filter.approverStatus);
  }
  if (filter.year) {
    where.push('YEAR(r.start_date) = ?');
    params.push(filter.year);
  }
  if (filter.search) {
    where.push('(r.name LIKE ? OR r.nip LIKE ? OR CAST(r.id AS CHAR) = ? OR l.number LIKE ?)');
    const like = `%${filter.search}%`;
    params.push(like, like, filter.search, like);
  }
  if (filter.letterStatus === 'with') {
    where.push("l.number IS NOT NULL AND l.number <> ''");
  } else if (filter.letterStatus === 'without') {
    where.push("(l.number IS NULL OR l.number = '')");
  }
  if (filter.fileStatus === 'with') {
    where.push('l.document_id IS NOT NULL');
  } else if (filter.fileStatus === 'without') {
    where.push('l.document_id IS NULL');
  }
  if (filter.archive) {
    switch (filter.archive) {
      case 'belum_diperiksa':
        where.push("r.status NOT IN ('rejected', 'cancelled') AND r.admin_decision = 'pending'");
        break;
      case 'belum_kirim':
        where.push("r.status = 'approved' AND (l.number IS NULL OR l.number = '')");
        break;
      case 'sk_belum_upload':
        where.push("r.status = 'approved' AND (l.number IS NOT NULL AND l.number <> '') AND l.document_id IS NULL");
        break;
      case 'cuti_jadi':
        where.push("r.status = 'approved' AND (l.number IS NOT NULL AND l.number <> '') AND l.document_id IS NOT NULL");
        break;
      case 'ditolak':
        where.push("r.status = 'rejected'");
        break;
      case 'dibatalkan':
        where.push("r.status = 'cancelled'");
        break;
    }
  }

  const limit = Math.min(Math.max(filter.limit ?? 25, 1), 200);
  const offset = Math.max(filter.offset ?? 0, 0);
  params.push(limit, offset);

  const sql = `
    SELECT r.*,
           l.number AS letter_number,
             l.document_id AS letter_document_id,
             (SELECT d.id
                FROM document_links dl
                JOIN documents d ON d.id = dl.document_id
               WHERE dl.entity_table = 'leave_requests' AND dl.entity_id = r.id AND dl.field = 'attachment'
               ORDER BY dl.id DESC
               LIMIT 1) AS attachment_document_id,
             (SELECT d.original_filename
                FROM document_links dl
                JOIN documents d ON d.id = dl.document_id
               WHERE dl.entity_table = 'leave_requests' AND dl.entity_id = r.id AND dl.field = 'attachment'
               ORDER BY dl.id DESC
               LIMIT 1) AS attachment_filename
        FROM leave_requests r
      LEFT JOIN leave_letters l ON l.leave_request_id = r.id AND l.letter_type = 'suket'
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY r.start_date DESC, r.id DESC
    LIMIT ? OFFSET ?
  `;
  return rows<LeaveRequestRow>(executor, sql, params);
};

export const countLeaveRequests = async (
  filter: {
    userId?: number;
    leaveType?: string;
    status?: string;
    adminDecision?: string;
    approverLevel?: 1 | 2;
    approverStatus?: 'pending' | 'accepted' | 'rejected';
    approverNip?: string;
    year?: number;
    search?: string;
    letterStatus?: 'with' | 'without';
    fileStatus?: 'with' | 'without';
    archive?: 'all' | 'belum_diperiksa' | 'belum_kirim' | 'sk_belum_upload' | 'cuti_jadi' | 'ditolak' | 'dibatalkan';
  },
  executor: Executor = getMySql(),
): Promise<number> => {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filter.userId) {
    where.push('r.user_id = ?');
    params.push(filter.userId);
  }
  if (filter.leaveType) {
    where.push('r.leave_type = ?');
    params.push(filter.leaveType);
  }
  if (filter.status) {
    const statuses = filter.status.split(',').map((s) => s.trim()).filter(Boolean);
    if (statuses.length > 1) {
      where.push(`r.status IN (${statuses.map(() => '?').join(', ')})`);
      params.push(...statuses);
    } else if (statuses.length === 1) {
      where.push('r.status = ?');
      params.push(statuses[0]);
    }
  }
  if (filter.adminDecision) {
    where.push('r.admin_decision = ?');
    params.push(filter.adminDecision);
  }
  if (filter.approverLevel === 1) {
    where.push("r.status NOT IN ('rejected', 'cancelled')");
    if (filter.approverStatus) {
      where.push('r.approver_1_status = ?');
      params.push(filter.approverStatus);
    } else {
      where.push("r.approver_1_status = 'pending'");
    }
    if (filter.approverNip) {
      where.push('r.approver_1_nip = ?');
      params.push(filter.approverNip);
    }
  } else if (filter.approverLevel === 2) {
    where.push("r.status NOT IN ('rejected', 'cancelled')");
    if (filter.approverStatus) {
      where.push('r.approver_2_status = ?');
      params.push(filter.approverStatus);
    } else {
      where.push("r.approver_2_status = 'pending'");
    }
    if (filter.approverNip) {
      where.push('r.approver_2_nip = ?');
      params.push(filter.approverNip);
    }
  } else if (filter.approverNip) {
    where.push('(r.approver_1_nip = ? OR r.approver_2_nip = ?)');
    params.push(filter.approverNip, filter.approverNip);
  }
  if (!filter.approverLevel && filter.approverStatus) {
    where.push('(r.approver_1_status = ? OR r.approver_2_status = ?)');
    params.push(filter.approverStatus, filter.approverStatus);
  }
  if (filter.year) {
    where.push('YEAR(r.start_date) = ?');
    params.push(filter.year);
  }
  if (filter.search) {
    where.push('(r.name LIKE ? OR r.nip LIKE ? OR CAST(r.id AS CHAR) = ? OR l.number LIKE ?)');
    const like = `%${filter.search}%`;
    params.push(like, like, filter.search, like);
  }
  if (filter.letterStatus === 'with') {
    where.push("l.number IS NOT NULL AND l.number <> ''");
  } else if (filter.letterStatus === 'without') {
    where.push("(l.number IS NULL OR l.number = '')");
  }
  if (filter.fileStatus === 'with') {
    where.push('l.document_id IS NOT NULL');
  } else if (filter.fileStatus === 'without') {
    where.push('l.document_id IS NULL');
  }
  if (filter.archive) {
    switch (filter.archive) {
      case 'belum_diperiksa':
        where.push("r.status NOT IN ('rejected', 'cancelled') AND r.admin_decision = 'pending'");
        break;
      case 'belum_kirim':
        where.push("r.status = 'approved' AND (l.number IS NULL OR l.number = '')");
        break;
      case 'sk_belum_upload':
        where.push("r.status = 'approved' AND (l.number IS NOT NULL AND l.number <> '') AND l.document_id IS NULL");
        break;
      case 'cuti_jadi':
        where.push("r.status = 'approved' AND (l.number IS NOT NULL AND l.number <> '') AND l.document_id IS NOT NULL");
        break;
      case 'ditolak':
        where.push("r.status = 'rejected'");
        break;
      case 'dibatalkan':
        where.push("r.status = 'cancelled'");
        break;
    }
  }

  const sql = `
    SELECT COUNT(DISTINCT r.id) AS total
      FROM leave_requests r
      LEFT JOIN leave_letters l ON l.leave_request_id = r.id AND l.letter_type = 'suket'
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
  `;
  const result = await rows<{ total: number }>(executor, sql, params);
  return Number(result[0]?.total ?? 0);
};

/** Rekap arsip operasional legacy (belum diperiksa, belum kirim, SK belum upload, cuti jadi, ditolak, dibatalkan). */
export const countLeaveArchiveBuckets = async (
  filter: { userId?: number; year?: number } = {},
  executor: Executor = getMySql(),
): Promise<{
  belum_diperiksa: number;
  belum_kirim: number;
  sk_belum_upload: number;
  cuti_jadi: number;
  ditolak: number;
  dibatalkan: number;
  total: number;
}> => {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.userId) {
    where.push('r.user_id = ?');
    params.push(filter.userId);
  }
  if (filter.year) {
    where.push('YEAR(r.start_date) = ?');
    params.push(filter.year);
  }
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const sql = `
    SELECT
      COALESCE(COUNT(CASE WHEN r.status NOT IN ('rejected', 'cancelled') AND r.admin_decision = 'pending' THEN 1 END), 0) AS belum_diperiksa,
      COALESCE(COUNT(CASE WHEN r.status = 'approved' AND (l.number IS NULL OR l.number = '') THEN 1 END), 0) AS belum_kirim,
      COALESCE(COUNT(CASE WHEN r.status = 'approved' AND (l.number IS NOT NULL AND l.number <> '') AND l.document_id IS NULL THEN 1 END), 0) AS sk_belum_upload,
      COALESCE(COUNT(CASE WHEN r.status = 'approved' AND (l.number IS NOT NULL AND l.number <> '') AND l.document_id IS NOT NULL THEN 1 END), 0) AS cuti_jadi,
      COALESCE(COUNT(CASE WHEN r.status = 'rejected' THEN 1 END), 0) AS ditolak,
      COALESCE(COUNT(CASE WHEN r.status = 'cancelled' THEN 1 END), 0) AS dibatalkan,
      COUNT(DISTINCT r.id) AS total
    FROM leave_requests r
    LEFT JOIN leave_letters l ON l.leave_request_id = r.id AND l.letter_type = 'suket'
    ${whereClause}
  `;
  const result = await rows<Record<string, number>>(executor, sql, params);
  const row = result[0] ?? {};
  return {
    belum_diperiksa: Number(row.belum_diperiksa ?? 0),
    belum_kirim: Number(row.belum_kirim ?? 0),
    sk_belum_upload: Number(row.sk_belum_upload ?? 0),
    cuti_jadi: Number(row.cuti_jadi ?? 0),
    ditolak: Number(row.ditolak ?? 0),
    dibatalkan: Number(row.dibatalkan ?? 0),
    total: Number(row.total ?? 0),
  };
};

/** Rekap antrean persetujuan cuti berjenjang (Semua Menunggu, Atasan 1, Atasan 2, Admin, Cuti Jadi). */
export const countApprovalSummary = async (
  filter: { approverNip?: string } = {},
  executor: Executor = getMySql(),
): Promise<{
  all_pending: number;
  atasan_1: number;
  atasan_2: number;
  admin: number;
  approved: number;
  my_pending: number;
  my_atasan_1: number;
  my_atasan_2: number;
}> => {
  const params: unknown[] = [];
  const nip = filter.approverNip ? String(filter.approverNip).trim() : null;

  let myPendingCase = '0';
  let myAtasan1Case = '0';
  let myAtasan2Case = '0';

  if (nip) {
    myPendingCase = `CASE WHEN r.status NOT IN ('rejected', 'cancelled') AND ((r.approver_1_nip = ? AND r.approver_1_status = 'pending') OR (r.approver_2_nip = ? AND r.approver_2_status = 'pending')) THEN 1 END`;
    myAtasan1Case = `CASE WHEN r.status NOT IN ('rejected', 'cancelled') AND r.approver_1_status = 'pending' AND r.approver_1_nip = ? THEN 1 END`;
    myAtasan2Case = `CASE WHEN r.status NOT IN ('rejected', 'cancelled') AND r.approver_2_status = 'pending' AND r.approver_2_nip = ? THEN 1 END`;
    params.push(nip, nip, nip, nip);
  }

  const sql = `
    SELECT
      COALESCE(COUNT(CASE WHEN r.status NOT IN ('rejected', 'cancelled') AND (r.status IN ('submitted', 'in_review') OR r.admin_decision = 'pending' OR r.approver_1_status = 'pending' OR r.approver_2_status = 'pending') THEN 1 END), 0) AS all_pending,
      COALESCE(COUNT(CASE WHEN r.status NOT IN ('rejected', 'cancelled') AND r.approver_1_status = 'pending' THEN 1 END), 0) AS atasan_1,
      COALESCE(COUNT(CASE WHEN r.status NOT IN ('rejected', 'cancelled') AND r.approver_2_status = 'pending' THEN 1 END), 0) AS atasan_2,
      COALESCE(COUNT(CASE WHEN r.status NOT IN ('rejected', 'cancelled') AND r.admin_decision = 'pending' THEN 1 END), 0) AS admin,
      COALESCE(COUNT(CASE WHEN r.status = 'approved' THEN 1 END), 0) AS approved,
      COALESCE(COUNT(${myPendingCase}), 0) AS my_pending,
      COALESCE(COUNT(${myAtasan1Case}), 0) AS my_atasan_1,
      COALESCE(COUNT(${myAtasan2Case}), 0) AS my_atasan_2
    FROM leave_requests r
  `;

  const result = await rows<Record<string, number>>(executor, sql, params);
  const row = result[0] ?? {};
  return {
    all_pending: Number(row.all_pending ?? 0),
    atasan_1: Number(row.atasan_1 ?? 0),
    atasan_2: Number(row.atasan_2 ?? 0),
    admin: Number(row.admin ?? 0),
    approved: Number(row.approved ?? 0),
    my_pending: Number(row.my_pending ?? 0),
    my_atasan_1: Number(row.my_atasan_1 ?? 0),
    my_atasan_2: Number(row.my_atasan_2 ?? 0),
  };
};

/** Hitungan jumlah permohonan per status + jenis, untuk dasbor dan arsip. */
export const countLeaveRequestsGrouped = async (
  groupBy: 'status' | 'leave_type',
  filter: { userId?: number; year?: number } = {},
  executor: Executor = getMySql(),
): Promise<Array<{ key: string; total: number; days: number }>> => {
  const column = groupBy === 'status' ? 'status' : 'leave_type';
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.userId) {
    where.push('user_id = ?');
    params.push(filter.userId);
  }
  if (filter.year) {
    where.push('YEAR(start_date) = ?');
    params.push(filter.year);
  }
  const sql = `
    SELECT ${column} AS \`key\`, COUNT(*) AS total, COALESCE(SUM(IF(duration_unit='day', duration, 0)),0) AS days
      FROM leave_requests
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     GROUP BY ${column}
     ORDER BY total DESC
  `;
  return rows<{ key: string; total: number; days: number }>(executor, sql, params);
};

export const findLeaveRequestById = async (
  id: number,
  executor: Executor = getMySql(),
): Promise<LeaveRequestRow | null> => {
  const result = await rows<LeaveRequestRow>(
    executor,
    'SELECT * FROM leave_requests WHERE id = ? LIMIT 1',
    [id],
  );
  return result[0] ?? null;
};

export const findLeaveRequestByLegacyId = async (
  legacyId: string,
  executor: Executor = getMySql(),
): Promise<LeaveRequestRow | null> => {
  const result = await rows<LeaveRequestRow>(
    executor,
    'SELECT * FROM leave_requests WHERE legacy_id = ? LIMIT 1',
    [legacyId],
  );
  return result[0] ?? null;
};

/** Semua transaksi cuti user — bahan mentah engine kuota. */
export const findLeaveTransactionsByUser = async (
  userId: number,
  executor: Executor = getMySql(),
): Promise<LeaveTransactionRow[]> =>
  rows<LeaveTransactionRow>(
    executor,
    `SELECT id, leave_type, duration, duration_unit, start_date,
            admin_decision, approver_1_status, approver_2_status
       FROM leave_requests
      WHERE user_id = ?
      ORDER BY start_date ASC, id ASC`,
    [userId],
  );

export const findLeavePolicyByYear = async (
  year: number,
  executor: Executor = getMySql(),
): Promise<LeavePolicyRow | null> => {
  const result = await rows<LeavePolicyRow>(
    executor,
    'SELECT * FROM leave_policies WHERE year = ? LIMIT 1',
    [year],
  );
  return result[0] ?? null;
};

export const findAllLeavePolicies = async (
  executor: Executor = getMySql(),
): Promise<LeavePolicyRow[]> =>
  rows<LeavePolicyRow>(executor, 'SELECT * FROM leave_policies ORDER BY year DESC');

/** Hanya periode aktif — dipakai pengecekan saat pengajuan. */
export const findClosurePeriods = async (
  executor: Executor = getMySql(),
): Promise<Array<{ id: number; year: number; start_date: string; end_date: string; enabled: number; message: string | null }>> =>
  rows(
    executor,
    'SELECT id, year, start_date, end_date, enabled, message FROM leave_closure_periods WHERE enabled = 1 ORDER BY start_date DESC',
  );

/** Semua periode termasuk yang nonaktif — dipakai halaman pengaturan admin. */
export const findAllClosurePeriods = async (
  executor: Executor = getMySql(),
): Promise<LeaveClosurePeriodRow[]> =>
  rows<LeaveClosurePeriodRow>(
    executor,
    `SELECT id, year, start_date, end_date, enabled, message, created_by, updated_by, created_at, updated_at
       FROM leave_closure_periods ORDER BY start_date DESC`,
  );

export const findPppkTmtByNip = async (
  nip: string,
  executor: Executor = getMySql(),
): Promise<string | null> => {
  const result = await rows<{ tmt_date: string | null }>(
    executor,
    "SELECT value AS tmt_date FROM settings WHERE `key` = CONCAT('pppk_tmt:', ?) LIMIT 1",
    [nip],
  );
  return result[0]?.tmt_date ?? null;
};

export const findUserNipById = async (
  userId: number,
  executor: Executor = getMySql(),
): Promise<string | null> => {
  const result = await rows<{ nip: string | null }>(
    executor,
    'SELECT nip FROM users WHERE id = ? LIMIT 1',
    [userId],
  );
  return result[0]?.nip ?? null;
};

export const findUserProfileById = async (
  userId: number,
  executor: Executor = getMySql(),
): Promise<{
  id: number;
  name: string;
  nip: string | null;
  grade: string | null;
  unit_name: string | null;
  position_name: string | null;
  organization_name: string | null;
} | null> => {
  const result = await rows<{
    id: number;
    name: string;
    nip: string | null;
    grade: string | null;
    unit_name: string | null;
    position_name: string | null;
    organization_name: string | null;
  }>(
    executor,
    `SELECT u.id, u.name, u.nip, u.grade, u.unit_name,
            p.name AS position_name, o.name AS organization_name
       FROM users u
       LEFT JOIN positions p ON p.id = u.position_id
       LEFT JOIN organizations o ON o.id = u.organization_id
      WHERE u.id = ? LIMIT 1`,
    [userId],
  );
  return result[0] ?? null;
};

export const getAllActiveUserIds = async (
  executor: Executor = getMySql(),
): Promise<number[]> => {
  const result = await rows<{ id: number }>(executor, 'SELECT id FROM users WHERE is_active = 1 ORDER BY id');
  return result.map((row) => Number(row.id));
};

/** Daftar pegawai untuk halaman kelola kuota (dengan unit kerja). */
export const findUserDirectory = async (
  filter: { search?: string; limit?: number; offset?: number } = {},
  executor: Executor = getMySql(),
): Promise<{
  id: number;
  name: string;
  nip: string | null;
  unit_name: string | null;
  position_name: string | null;
  is_active: number;
}[]> => {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.search) {
    where.push('(u.name LIKE ? OR u.nip LIKE ?)');
    const like = `%${filter.search}%`;
    params.push(like, like);
  }
  params.push(Math.min(Math.max(filter.limit ?? 25, 1), 200), Math.max(filter.offset ?? 0, 0));
  return rows(
    executor,
    `SELECT u.id, u.name, u.nip, u.unit_name, p.name AS position_name, u.is_active
       FROM users u
       LEFT JOIN positions p ON p.id = u.position_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY u.name ASC
      LIMIT ? OFFSET ?`,
    params,
  );
};

export const countUserDirectory = async (
  filter: { search?: string } = {},
  executor: Executor = getMySql(),
): Promise<number> => {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.search) {
    where.push('(name LIKE ? OR nip LIKE ?)');
    const like = `%${filter.search}%`;
    params.push(like, like);
  }
  const result = await rows<{ total: number }>(
    executor,
    `SELECT COUNT(*) AS total FROM users ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`,
    params,
  );
  return Number(result[0]?.total ?? 0);
};

export const findLeaveQuotasByUser = async (
  userId: number,
  executor: Executor = getMySql(),
): Promise<unknown[]> =>
  rows(executor, 'SELECT * FROM leave_quotas WHERE user_id = ? ORDER BY year DESC', [userId]);

/** Projection tersimpan user, terbaru lebih dulu (untuk kartu saldo). */
export const findStoredQuotasByUser = async (
  userId: number,
  executor: Executor = getMySql(),
): Promise<StoredQuotaRow[]> =>
  rows<StoredQuotaRow>(
    executor,
    `SELECT year, remaining_n, remaining_n1, remaining_n2, total_remaining,
            reserved_days, reserved_count, eligible, manual_validation, computed_at
       FROM leave_quotas
      WHERE user_id = ?
      ORDER BY year DESC`,
    [userId],
  );

export const findLeaveQuota = async (
  userId: number,
  year: number,
  executor: Executor = getMySql(),
): Promise<unknown | null> => {
  const result = await rows(
    executor,
    'SELECT * FROM leave_quotas WHERE user_id = ? AND year = ? LIMIT 1',
    [userId, year],
  );
  return result[0] ?? null;
};

/**
 * Buku cuti: projection seluruh pegawai untuk satu tahun, nama ikut dibaca
 * supaya barisnya bisa langsung dicetak tanpa query per pegawai.
 */
export const findQuotaBookRows = async (
  year: number,
  filter: { search?: string; limit?: number; offset?: number } = {},
  executor: Executor = getMySql(),
): Promise<Array<StoredQuotaRow & { user_id: number; name: string; nip: string | null; unit_name: string | null }>> => {
  const where: string[] = ['q.year = ?'];
  const params: unknown[] = [year];
  if (filter.search) {
    where.push('(u.name LIKE ? OR u.nip LIKE ? OR CAST(u.id AS CHAR) = ?)');
    const like = `%${filter.search}%`;
    params.push(like, like, filter.search);
  }
  params.push(Math.min(Math.max(filter.limit ?? 50, 1), 500), Math.max(filter.offset ?? 0, 0));
  return rows(
    executor,
    `SELECT q.user_id, q.year, q.remaining_n, q.remaining_n1, q.remaining_n2, q.total_remaining,
            q.reserved_days, q.reserved_count, q.eligible, q.manual_validation, q.computed_at,
            u.name, u.nip, u.unit_name
       FROM leave_quotas q
       JOIN users u ON u.id = q.user_id
      WHERE ${where.join(' AND ')}
      ORDER BY u.name ASC
      LIMIT ? OFFSET ?`,
    params,
  );
};

export const findLeaveQuotaAudits = async (
  userId: number,
  year: number | undefined,
  limit = 50,
  executor: Executor = getMySql(),
): Promise<unknown[]> => {
  const params: unknown[] = [userId];
  let sql = 'SELECT * FROM leave_quota_audits WHERE user_id = ?';
  if (year) {
    sql += ' AND year = ?';
    params.push(year);
  }
  sql += ' ORDER BY created_at DESC, id DESC LIMIT ?';
  params.push(Math.min(Math.max(limit, 1), 500));
  return rows(executor, sql, params);
};

/** Riwayat mutasi kuota lintas user, untuk halaman audit admin. */
export const findRecentQuotaAudits = async (
  filter: { action?: string; year?: number; limit?: number } = {},
  executor: Executor = getMySql(),
): Promise<unknown[]> => {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.action) {
    where.push('a.action = ?');
    params.push(filter.action);
  }
  if (filter.year) {
    where.push('a.year = ?');
    params.push(filter.year);
  }
  params.push(Math.min(Math.max(filter.limit ?? 50, 1), 500));
  return rows(
    executor,
    `SELECT a.*, u.name AS user_name
       FROM leave_quota_audits a
       LEFT JOIN users u ON u.id = a.user_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT ?`,
    params,
  );
};

// ---------------------------------------------------------------------------
// Surat keterangan
// ---------------------------------------------------------------------------

export const findLeaveLetters = async (
  filter: { letterType?: string; search?: string; limit?: number; offset?: number } = {},
  executor: Executor = getMySql(),
): Promise<Array<LeaveLetterRow & { name: string; nip: string | null; leave_type: string }>> => {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.letterType) {
    where.push('l.letter_type = ?');
    params.push(filter.letterType);
  }
  if (filter.search) {
    where.push('(l.number LIKE ? OR r.name LIKE ? OR r.nip LIKE ?)');
    const like = `%${filter.search}%`;
    params.push(like, like, like);
  }
  params.push(Math.min(Math.max(filter.limit ?? 25, 1), 200), Math.max(filter.offset ?? 0, 0));
  return rows(
    executor,
    `SELECT l.*, r.name, r.nip, r.leave_type
       FROM leave_letters l
       JOIN leave_requests r ON r.id = l.leave_request_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY l.issued_at DESC, l.id DESC
      LIMIT ? OFFSET ?`,
    params,
  );
};

export const findLeaveLetterByRequest = async (
  leaveRequestId: number,
  executor: Executor = getMySql(),
): Promise<LeaveLetterRow[]> =>
  rows<LeaveLetterRow>(
    executor,
    'SELECT * FROM leave_letters WHERE leave_request_id = ? ORDER BY letter_type',
    [leaveRequestId],
  );

export const findLeaveLetterById = async (
  id: number,
  executor: Executor = getMySql(),
): Promise<LeaveLetterRow | null> => {
  const result = await rows<LeaveLetterRow>(
    executor,
    'SELECT * FROM leave_letters WHERE id = ? LIMIT 1',
    [id],
  );
  return result[0] ?? null;
};

// ---------------------------------------------------------------------------
// Pengaturan instansi dan TMT PPPK
// ---------------------------------------------------------------------------

export const findSettingsByPrefix = async (
  prefix: string,
  executor: Executor = getMySql(),
): Promise<Array<{ key: string; value: string | null; description: string | null }>> =>
  rows(
    executor,
    'SELECT `key`, value, description FROM settings WHERE `key` LIKE ? ORDER BY `key`',
    [`${prefix}%`],
  );

export const findSetting = async (
  key: string,
  executor: Executor = getMySql(),
): Promise<{ key: string; value: string | null; description: string | null } | null> => {
  const result = await rows<{ key: string; value: string | null; description: string | null }>(
    executor,
    'SELECT `key`, value, description FROM settings WHERE `key` = ? LIMIT 1',
    [key],
  );
  return result[0] ?? null;
};

/** Daftar NIP PPPK yang TMT-nya tercatat — sumber halaman validasi TMT. */
export const findPppkTmtEntries = async (
  executor: Executor = getMySql(),
): Promise<Array<{ nip: string; tmt_date: string; name: string | null }>> =>
  rows(
    executor,
    `SELECT SUBSTRING(s.\`key\`, 10) AS nip, s.value AS tmt_date, u.name
       FROM settings s
       LEFT JOIN users u ON u.nip = SUBSTRING(s.\`key\`, 10)
      WHERE s.\`key\` LIKE 'pppk_tmt:%'
      ORDER BY s.value DESC`,
  );

/** Pegawai PPPK yang belum punya TMT — perlu divalidasi admin. */
export const findPppkUsersMissingTmt = async (
  executor: Executor = getMySql(),
): Promise<Array<{ id: number; name: string; nip: string | null; unit_name: string | null }>> =>
  rows(
    executor,
    `SELECT u.id, u.name, u.nip, u.unit_name
       FROM users u
       LEFT JOIN settings s ON s.\`key\` = CONCAT('pppk_tmt:', u.nip)
      WHERE u.nip IS NOT NULL
        AND LENGTH(REPLACE(u.nip, '-', '')) = 18
        AND SUBSTRING(REPLACE(u.nip, '-', ''), 15, 2) = '21'
        AND s.id IS NULL
      ORDER BY u.name ASC`,
  );

export const findAuditLogs = async (
  filter: { entityTable?: string; action?: string; limit?: number } = {},
  executor: Executor = getMySql(),
): Promise<unknown[]> => {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.entityTable) {
    where.push('entity_table = ?');
    params.push(filter.entityTable);
  }
  if (filter.action) {
    where.push('action = ?');
    params.push(filter.action);
  }
  params.push(Math.min(Math.max(filter.limit ?? 50, 1), 500));
  return rows(
    executor,
    `SELECT * FROM audit_logs
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY created_at DESC, id DESC
      LIMIT ?`,
    params,
  );
};

// ---------------------------------------------------------------------------
// Penyesuaian kuota manual admin
// ---------------------------------------------------------------------------

/** Semua penyesuaian satu user+tahun — dipakai engine dan halaman kelola kuota. */
export const findQuotaAdjustments = async (
  userId: number,
  year?: number,
  executor: Executor = getMySql(),
): Promise<Array<{ id: number; user_id: number; year: number; days: number; reason: string | null; actor_id: number | null; created_at: string }>> => {
  const params: unknown[] = [userId];
  let sql = 'SELECT * FROM leave_quota_adjustments WHERE user_id = ?';
  if (year) {
    sql += ' AND year = ?';
    params.push(year);
  }
  sql += ' ORDER BY created_at DESC, id DESC';
  return rows(executor, sql, params);
};

export const sumQuotaAdjustments = async (
  userId: number,
  year: number,
  executor: Executor = getMySql(),
): Promise<number> => {
  try {
    const result = await rows<{ total: number | null }>(
      executor,
      // Hanya bucket 'n': koreksi jatah tahun berjalan. Koreksi N-1/N-2 dibaca
      // terpisah oleh `sumQuotaAdjustmentsByBucket` supaya tidak dihitung dua kali.
      "SELECT SUM(days) AS total FROM leave_quota_adjustments WHERE user_id = ? AND year = ? AND bucket = 'n'",
      [userId, year],
    );
    return Number(result[0]?.total ?? 0);
  } catch {
    return 0;
  }
};

/**
 * Penyesuaian per bucket. `n` = tahun berjalan, `n1`/`n2` = koreksi jatah
 * bawaan tahun sebelumnya yang dicatat admin.
 */
export const sumQuotaAdjustmentsByBucket = async (
  userId: number,
  year: number,
  executor: Executor = getMySql(),
): Promise<{ n: number; n1: number; n2: number }> => {
  try {
    const result = await rows<{ bucket: string; total: number | null }>(
      executor,
      `SELECT bucket, SUM(days) AS total
         FROM leave_quota_adjustments
        WHERE user_id = ? AND year = ?
        GROUP BY bucket`,
      [userId, year],
    );
    const totals = { n: 0, n1: 0, n2: 0 };
    for (const row of result) {
      if (row.bucket === 'n' || row.bucket === 'n1' || row.bucket === 'n2') {
        totals[row.bucket] = Number(row.total ?? 0);
      }
    }
    return totals;
  } catch {
    return { n: 0, n1: 0, n2: 0 };
  }
};

/** Riwayat cuti pra-2020 hasil migrasi `tbl_n2019`; tidak memengaruhi kuota. */
export const findLeaveLegacyHistory = async (
  filter: { userId?: number; year?: number } = {},
  executor: Executor = getMySql(),
): Promise<Array<{
  user_id: number;
  year: number;
  leave_type: string;
  duration: number;
  duration_unit: string;
  start_date: string | null;
  end_date: string | null;
  number: string | null;
  issued_at: string | null;
}>> => {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.userId) {
    where.push('user_id = ?');
    params.push(filter.userId);
  }
  if (filter.year) {
    where.push('year = ?');
    params.push(filter.year);
  }
  try {
    return await rows(
      executor,
      `SELECT user_id, year, leave_type, duration, duration_unit, start_date, end_date, number, issued_at
         FROM leave_legacy_history
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY year ASC, start_date ASC, id ASC`,
      params,
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const code = (err as { code?: string })?.code;
    if (code === 'ER_NO_SUCH_TABLE' || msg.includes("doesn't exist")) {
      return [];
    }
    throw err;
  }
};

/**
 * Rekap tahunan untuk dasbor admin (legacy `admin.php:240-265`).
 *
 * Dihitung dari `status` permohonan, bukan dari tabel cache, dan
 * `cancelled` dipisah sendiri supaya angkanya sebanding dengan counter legacy
 * (Pengajuan / Diterima / Ditolak / Dibatalkan).
 */
export const countLeaveRequestsByYear = async (
  executor: Executor = getMySql(),
): Promise<Array<{ year: number; submitted: number; approved: number; rejected: number; cancelled: number; total: number }>> =>
  rows(
    executor,
    `SELECT YEAR(start_date) AS year,
            SUM(status IN ('submitted','in_review')) AS submitted,
            SUM(status = 'approved') AS approved,
            SUM(status = 'rejected') AS rejected,
            SUM(status = 'cancelled') AS cancelled,
            COUNT(*) AS total
       FROM leave_requests
      GROUP BY YEAR(start_date)
      ORDER BY year DESC`,
  );

/** Riwayat cuti pra-2020 milik semua pegawai untuk buku cuti satu tahun. */
export const findLeaveLegacyHistoryByYear = async (
  year: number,
  executor: Executor = getMySql(),
): Promise<Array<{ user_id: number; name: string; nip: string | null; leave_type: string; duration: number; duration_unit: string; start_date: string | null; end_date: string | null; number: string | null; issued_at: string | null }>> => {
  try {
    return await rows(
      executor,
      `SELECT h.user_id, u.name, u.nip, h.leave_type, h.duration, h.duration_unit,
              h.start_date, h.end_date, h.number, h.issued_at
         FROM leave_legacy_history h
         JOIN users u ON u.id = h.user_id
        WHERE h.year = ?
        ORDER BY u.name ASC, h.start_date ASC`,
      [year],
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const code = (err as { code?: string })?.code;
    if (code === 'ER_NO_SUCH_TABLE' || msg.includes("doesn't exist")) {
      return [];
    }
    throw err;
  }
};

// ---------------------------------------------------------------------------
// Ekspor permohonan (Excel/CSV)
// ---------------------------------------------------------------------------

/**
 * Baris ekspor permohonan cuti — cerminan kolom yang dipakai legacy
 * `transaksi_surat_masuk.php` (17 kolom, termasuk status SK).
 *
 * Filter tanggal memakai `start_date` permohonan (legacy: `tgl_dibuat`), dan
 * status SK diselesaikan lewat `LEFT JOIN leave_letters` supaya permohonan
 * yang belum bersurat tetap muncul di ekspor "Belum ada SK".
 */
export const findLeaveRequestsForExport = async (
  filter: {
    dateFrom?: string;
    dateTo?: string;
    leaveType?: string;
    statuses?: string[];
    letterStatus?: 'with' | 'without';
    search?: string;
    userId?: number;
    limit?: number;
  },
  executor: Executor = getMySql(),
): Promise<Array<Record<string, unknown>>> => {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filter.dateFrom) {
    where.push('r.start_date >= ?');
    params.push(filter.dateFrom);
  }
  if (filter.dateTo) {
    where.push('r.start_date <= ?');
    params.push(filter.dateTo);
  }
  if (filter.userId) {
    where.push('r.user_id = ?');
    params.push(filter.userId);
  }
  if (filter.leaveType) {
    where.push('r.leave_type = ?');
    params.push(filter.leaveType);
  }
  if (filter.statuses?.length) {
    where.push(`r.status IN (${filter.statuses.map(() => '?').join(', ')})`);
    params.push(...filter.statuses);
  }
  if (filter.letterStatus === 'with') {
    where.push("l.number IS NOT NULL AND l.number <> ''");
  } else if (filter.letterStatus === 'without') {
    where.push("(l.number IS NULL OR l.number = '')");
  }
  if (filter.search) {
    const like = `%${filter.search}%`;
    where.push('(r.name LIKE ? OR r.nip LIKE ? OR r.leave_type LIKE ? OR r.organization_name LIKE ? OR l.number LIKE ?)');
    params.push(like, like, like, like, like);
  }

  params.push(Math.min(Math.max(filter.limit ?? 5000, 1), 20000));

  return rows(
    executor,
    `SELECT r.id, r.name, r.nip, r.grade, r.position, r.organization_name,
            r.leave_type, r.reason, r.duration, r.duration_unit,
            r.start_date, r.end_date, r.created_at,
            r.status, r.admin_decision, r.approver_1_status, r.approver_2_status,
            r.rejection_reason,
            l.letter_type, l.number AS letter_number, l.issued_at AS letter_issued_at,
            l.document_id AS letter_document_id
       FROM leave_requests r
       LEFT JOIN leave_letters l ON l.leave_request_id = r.id AND l.letter_type = 'suket'
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY r.start_date ASC, r.id ASC
      LIMIT ?`,
    params,
  );
};

/** Pernyataan layak manual admin untuk satu user+tahun, bila ada. */
export const findEligibilityOverride = async (
  userId: number,
  year: number,
  executor: Executor = getMySql(),
): Promise<{ active: boolean; reason: string | null }> => {
  const result = await rows<{ value: string | null; description: string | null }>(
    executor,
    'SELECT value, description FROM settings WHERE `key` = ? LIMIT 1',
    [`leave_override:${userId}:${year}`],
  );
  if (!result[0]) return { active: false, reason: null };
  return { active: true, reason: result[0].description ?? null };
};

/** Pengaturan instansi (kop surat, nama kantor) yang tersimpan sebagai settings. */
export const findInstanceProfile = async (
  executor: Executor = getMySql(),
): Promise<Record<string, string | null>> => {
  const result = await rows<{ key: string; value: string | null }>(
    executor,
    "SELECT `key`, value FROM settings WHERE `key` LIKE 'instance.%'",
  );
  const profile: Record<string, string | null> = {};
  for (const row of result) {
    profile[row.key.replace(/^instance\./, '')] = row.value;
  }
  return profile;
};

export type ApproverSuggestionRow = {
  id: number;
  name: string;
  nip: string | null;
  position: string | null;
  unit_name: string | null;
  role: string;
};

export const queryApproverSuggestions = async (
  filter: { search?: string; limit?: number } = {},
  executor: Executor = getMySql(),
): Promise<ApproverSuggestionRow[]> => {
  const params: unknown[] = [];
  let userWhere = 'u.is_active = 1';
  let lr1Where = "approver_1_name IS NOT NULL AND TRIM(approver_1_name) <> ''";
  let lr2Where = "approver_2_name IS NOT NULL AND TRIM(approver_2_name) <> ''";

  if (filter.search && filter.search.trim()) {
    const like = `%${filter.search.trim()}%`;
    userWhere += ' AND (u.name LIKE ? OR u.nip LIKE ? OR p.name LIKE ?)';
    lr1Where += ' AND (approver_1_name LIKE ? OR approver_1_nip LIKE ? OR approver_1_position LIKE ?)';
    lr2Where += ' AND (approver_2_name LIKE ? OR approver_2_nip LIKE ? OR approver_2_position LIKE ?)';
    params.push(like, like, like, like, like, like, like, like, like);
  }

  const limit = Math.min(Math.max(filter.limit ?? 25, 1), 100);
  params.push(limit);

  const sql = `
    SELECT id, name, nip, position, unit_name, role FROM (
      SELECT u.id, u.name, u.nip, COALESCE(p.name, u.unit_name, '') AS position, u.unit_name, u.role
        FROM users u
        LEFT JOIN positions p ON p.id = u.position_id
       WHERE ${userWhere}
      UNION
      SELECT DISTINCT
             CAST(100000 + (CRC32(CONCAT(COALESCE(approver_1_nip, ''), approver_1_name)) % 100000) AS UNSIGNED) AS id,
             approver_1_name AS name,
             approver_1_nip AS nip,
             COALESCE(approver_1_position, '') AS position,
             '' AS unit_name,
             'atasan' AS role
        FROM leave_requests
       WHERE ${lr1Where}
      UNION
      SELECT DISTINCT
             CAST(200000 + (CRC32(CONCAT(COALESCE(approver_2_nip, ''), approver_2_name)) % 100000) AS UNSIGNED) AS id,
             approver_2_name AS name,
             approver_2_nip AS nip,
             COALESCE(approver_2_position, '') AS position,
             '' AS unit_name,
             'atasan' AS role
        FROM leave_requests
       WHERE ${lr2Where}
    ) AS approvers_pool
    GROUP BY name, nip, position, role
    ORDER BY name ASC
    LIMIT ?
  `;

  return rows<ApproverSuggestionRow>(executor, sql, params);
};
