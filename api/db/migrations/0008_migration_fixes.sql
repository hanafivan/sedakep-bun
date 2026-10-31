-- Perbaikan tipe kolom yang ditemukan saat migrasi data legacy.
SET NAMES utf8mb4;

-- alasan penolakan legacy bertipe TEXT; sempit kalau VARCHAR(500).
ALTER TABLE leave_requests
  MODIFY COLUMN rejection_reason TEXT DEFAULT NULL;

-- `anomaly_flag` bisa memuat lebih dari satu temuan sekaligus.
ALTER TABLE leave_requests
  MODIFY COLUMN anomaly_flag VARCHAR(150) DEFAULT NULL;

-- `documents.original_filename` bisa sangat panjang di data legacy.
ALTER TABLE documents
  MODIFY COLUMN original_filename VARCHAR(500) NOT NULL;

-- Query migrasi & rekonsiliasi memfilter per tabel + status.
CREATE TABLE IF NOT EXISTS migration_runs (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  scope       VARCHAR(75)   NOT NULL,
  started_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TIMESTAMP     NULL DEFAULT NULL,
  read_count  INT UNSIGNED  NOT NULL DEFAULT 0,
  written     INT UNSIGNED  NOT NULL DEFAULT 0,
  skipped     INT UNSIGNED  NOT NULL DEFAULT 0,
  failed      INT UNSIGNED  NOT NULL DEFAULT 0,
  payload     JSON          DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_migration_runs_scope (scope, started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
