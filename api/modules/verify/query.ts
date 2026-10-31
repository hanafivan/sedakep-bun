import type { RowDataPacket } from 'mysql2/promise';
import { getMySql } from '../../db/mysql';

/**
 * QUERY untuk endpoint verifikasi publik. Hanya kolom non-sensitif yang dibaca
 * supaya pemindaian QR tidak membocorkan data pribadi.
 */

const one = async <T>(sql: string, params: unknown[]): Promise<T | null> => {
  const [rows] = await getMySql().query<RowDataPacket[]>(sql, params);
  return (rows[0] as unknown as T) ?? null;
};

export const findAssignmentSummary = (id: number) =>
  one<{
    id: number;
    letter_number: string | null;
    code: string | null;
    start_date: string | null;
    end_date: string | null;
    status: string;
    decision: string;
    signer_name: string | null;
  }>(
    `SELECT id, letter_number, code, start_date, end_date, status, decision, signer_name
       FROM assignment_letters WHERE id = ? LIMIT 1`,
    [id],
  );

export const findLeaveSummary = (id: number) =>
  one<{
    id: number;
    name: string;
    leave_type: string;
    start_date: string | null;
    end_date: string | null;
    status: string;
    letter_number: string | null;
  }>(
    `SELECT r.id, r.name, r.leave_type, r.start_date, r.end_date, r.status,
            l.number AS letter_number
       FROM leave_requests r
       LEFT JOIN leave_letters l ON l.leave_request_id = r.id AND l.letter_type = 'suket'
      WHERE r.id = ? LIMIT 1`,
    [id],
  );

export const findLeaveFullDetailForVerify = (id: number) =>
  one<{
    id: number;
    user_id: number;
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
    status: string;
    admin_decision: string;
    approver_1_name: string | null;
    approver_1_nip: string | null;
    approver_1_position: string | null;
    approver_1_status: string;
    approver_2_name: string | null;
    approver_2_nip: string | null;
    approver_2_position: string | null;
    approver_2_status: string;
    legacy_quota_n: number | null;
    legacy_quota_n1: number | null;
    legacy_quota_n2: number | null;
    legacy_note_n: string | null;
    legacy_note_n1: string | null;
    legacy_note_n2: string | null;
    submitted_at: string;
    created_at: string;
    letter_number: string | null;
  }>(
    `SELECT r.*,
            l.number AS letter_number
       FROM leave_requests r
       LEFT JOIN leave_letters l ON l.leave_request_id = r.id AND l.letter_type = 'suket'
      WHERE r.id = ? LIMIT 1`,
    [id],
  );

export const findInstanceForVerify = () =>
  one<{
    name: string;
    head_name: string | null;
    head_nip: string | null;
    head_title: string | null;
    address: string | null;
    phone: string | null;
    city: string | null;
  }>(`SELECT name, head_name, head_nip, head_title, address, phone, city FROM master_instances LIMIT 1`, []);

export const findServiceSummary = (id: number) =>
  one<{
    id: number;
    service_type: string;
    name: string;
    title: string | null;
    status: string;
    decision: string;
  }>(
    `SELECT id, service_type, name, title, status, decision
       FROM service_requests WHERE id = ? LIMIT 1`,
    [id],
  );

export const findAlibiSummary = (id: number) =>
  one<{
    id: number;
    name: string;
    alibi_type: string | null;
    alibi_date: string | null;
    status: string;
  }>(
    `SELECT id, name, alibi_type, alibi_date, status FROM alibi_requests WHERE id = ? LIMIT 1`,
    [id],
  );

export const findIncomingSummary = (id: number) =>
  one<{
    id: number;
    letter_number: string | null;
    agenda_number: string | null;
    origin: string | null;
    received_date: string | null;
    status: string;
  }>(
    `SELECT id, letter_number, agenda_number, origin, received_date, status
       FROM incoming_letters WHERE id = ? LIMIT 1`,
    [id],
  );
