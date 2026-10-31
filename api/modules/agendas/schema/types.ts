/**
 * Tipe internal modul agenda. Padanan legacy `hlm_agenda`.
 * `report` di legacy adalah nama berkas hasil unggahan; di sini teks laporan
 * (berkasnya lewat documents).
 */

export type AgendaRow = {
  id: number;
  legacy_id: string | null;
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
