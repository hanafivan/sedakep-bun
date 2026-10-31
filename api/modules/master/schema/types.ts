/**
 * Tipe master data: organisasi (unit kerja) dan jabatan.
 * Padanan legacy `tbl_dept` / `tbl_jabatan`.
 */

export type OrganizationRow = {
  id: number;
  legacy_id: string | null;
  code: string;
  name: string;
  parent_id: number | null;
  level: number;
  is_active: number;
  created_at: string;
  updated_at: string;
};

export type PositionRow = {
  id: number;
  legacy_id: string | null;
  name: string;
  grade: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
};
