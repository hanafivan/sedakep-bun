/**
 * Tipe internal modul user: bentuk row database dan tipe input.
 * Beda dari schema request (yang memvalidasi input HTTP).
 */

export type Role = 'pegawai' | 'verifikator' | 'atasan' | 'admin';

export type UserRow = {
  id: number;
  legacy_id: string | null;
  username: string;
  password_hash: string;
  password_algo: 'md5' | 'bcrypt' | 'argon2id';
  must_rehash: number;
  name: string;
  nip: string | null;
  grade: string | null;
  position_id: number | null;
  organization_id: number | null;
  unit_name: string | null;
  email: string | null;
  phone: string | null;
  role: Role;
  is_admin: number;
  is_active: number;
  employment_type: 'pns' | 'pppk' | 'unknown';
  tmt_date: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
};

export type NewUser = {
  username: string;
  password_hash: string;
  password_algo?: 'md5' | 'bcrypt' | 'argon2id';
  name: string;
  nip?: string | null;
  legacy_id?: string | null;
  role?: Role;
  is_admin?: boolean;
  employment_type?: 'pns' | 'pppk' | 'unknown';
};
