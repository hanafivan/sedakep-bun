-- Surat keterangan cuti (SK cuti + SK madrasah) dan kolom pendukung administrasi cuti.
-- Legacy: tbl_suket (nomor surat + file_sk), tbl_suketmad (file_sk saja).
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS leave_letters (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  leave_request_id INT UNSIGNED NOT NULL,
  letter_type      ENUM('suket','suket_madrasah') NOT NULL DEFAULT 'suket',
  number           VARCHAR(100) DEFAULT NULL,
  issued_at        DATE         DEFAULT NULL,
  official_position VARCHAR(150) DEFAULT NULL,
  official_name    VARCHAR(150) DEFAULT NULL,
  document_id      INT UNSIGNED DEFAULT NULL,
  legacy_id        VARCHAR(64)  DEFAULT NULL,
  created_by       INT UNSIGNED DEFAULT NULL,
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_leave_letters_request_type (leave_request_id, letter_type),
  UNIQUE KEY uq_leave_letters_legacy (legacy_id),
  KEY idx_leave_letters_type (letter_type),
  CONSTRAINT fk_leave_letters_request FOREIGN KEY (leave_request_id)
    REFERENCES leave_requests (id) ON DELETE CASCADE,
  CONSTRAINT fk_leave_letters_document FOREIGN KEY (document_id)
    REFERENCES documents (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Penomoran surat per tahun per jenis; legacy menyimpan nomor sebagai urutan int.
CREATE TABLE IF NOT EXISTS leave_letter_counters (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  letter_type ENUM('suket','suket_madrasah') NOT NULL,
  year        YEAR NOT NULL,
  last_number INT  NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_leave_letter_counters (letter_type, year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Jejak siapa yang mengubah periode tutup dan kapan.
ALTER TABLE leave_closure_periods
  ADD COLUMN created_by INT UNSIGNED DEFAULT NULL,
  ADD COLUMN updated_by INT UNSIGNED DEFAULT NULL;

-- Cara angka kuota diperoleh admin (untuk audit override manual).
ALTER TABLE leave_quotas
  ADD COLUMN override_by INT UNSIGNED DEFAULT NULL,
  ADD COLUMN override_at TIMESTAMP NULL DEFAULT NULL;

-- Penyesuaian kuota manual oleh admin.
-- Disimpan sebagai data, bukan sebagai tulisan langsung ke projection, supaya
-- hasilnya ikut bertahan setiap kali projection dihitung ulang dari histori.
CREATE TABLE IF NOT EXISTS leave_quota_adjustments (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED NOT NULL,
  year       YEAR NOT NULL,
  days       INT NOT NULL,
  reason     VARCHAR(255) DEFAULT NULL,
  actor_id   INT UNSIGNED DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_leave_adjust_user_year (user_id, year),
  CONSTRAINT fk_leave_adjust_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
