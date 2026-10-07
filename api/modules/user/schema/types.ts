/**
 * Tipe data internal / bentuk row database.
 * Beda dari schema request (yang memvalidasi input HTTP).
 */

export type UserRow = {
  id: string;
  username: string;
  password: string;
  created_at: string;
  updated_at: string;
};

export type NewUser = {
  id: string;
  username: string;
  password: string;
};
