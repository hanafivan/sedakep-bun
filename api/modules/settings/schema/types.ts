/**
 * Tipe internal modul pengaturan. Padanan tabel `settings` legacy
 * (key/value) yang dipakai untuk identitas instansi, override kuota, TMT PPPK,
 * dan penanda job scheduler.
 */

export type SettingRow = {
  id: number;
  key: string;
  value: string | null;
  description: string | null;
  updated_at: string;
};
