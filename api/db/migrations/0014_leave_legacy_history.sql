-- Riwayat cuti pra-2020 yang di legacy disimpan di luar alur permohonan.
--
-- `tbl_n2019` (467 baris) berisi cuti 2019 yang dicatat manual: nomor, tanggal
-- cetak, jenis, lama, dan rentang tanggalnya. Baris ini TIDAK boleh masuk
-- `leave_requests` karena akan ikut dihitung engine kuota (mengubah pool 2019
-- dan carry-over tahun berikutnya). Yang dibutuhkan hanya bisa dibaca dan
-- dicetak di buku cuti, jadi bentuknya tabel riwayat terpisah tanpa efek kuota.
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS leave_legacy_history (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id        INT UNSIGNED NOT NULL,
  legacy_id      VARCHAR(64)  NOT NULL,
  year           YEAR         NOT NULL,
  leave_type     VARCHAR(40)  NOT NULL,
  duration       INT          NOT NULL DEFAULT 0,
  duration_unit  VARCHAR(10)  NOT NULL DEFAULT 'Hari',
  start_date     DATE         NULL,
  end_date       DATE         NULL,
  number         VARCHAR(100) NULL,
  issued_at      DATE         NULL,
  source_table   VARCHAR(64)  NOT NULL DEFAULT 'tbl_n2019',
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_leave_legacy_history (source_table, legacy_id),
  KEY idx_leave_legacy_history_user (user_id, year),
  CONSTRAINT fk_leave_legacy_history_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
