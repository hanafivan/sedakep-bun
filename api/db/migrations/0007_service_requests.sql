-- Layanan kepegawaian: satu tabel generik + nilai spesifik per jenis
-- + dokumen berlabel. Semua tabel legacy layanan punya core kolom yang sama
-- (nama, nip, jabatan, unit_kerja, gol, telepon, tgl_dibuat, id_user).
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS service_requests (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  legacy_table    VARCHAR(75) NOT NULL,
  legacy_id       VARCHAR(64) DEFAULT NULL,
  service_type    ENUM(
                    'gelar','karpeg','karisu','bpjs','taspen','satlen',
                    'ibel','tugas_belajar','pmk','skmi_skpp','pangkat',
                    'pensiun','satya_lencana'
                  ) NOT NULL,
  user_id         INT UNSIGNED NOT NULL,
  name            VARCHAR(120) NOT NULL,
  nip             VARCHAR(18)  DEFAULT NULL,
  grade           VARCHAR(20)  DEFAULT NULL,
  position        VARCHAR(150) DEFAULT NULL,
  organization_name VARCHAR(150) DEFAULT NULL,
  phone           VARCHAR(30)  DEFAULT NULL,
  title           VARCHAR(255) DEFAULT NULL,
  campus          VARCHAR(200) DEFAULT NULL,
  faculty         VARCHAR(200) DEFAULT NULL,
  major           VARCHAR(200) DEFAULT NULL,
  subtype         VARCHAR(50)  DEFAULT NULL,
  approver_1_name VARCHAR(150) DEFAULT NULL,
  approver_1_nip  VARCHAR(18)  DEFAULT NULL,
  approver_1_position VARCHAR(150) DEFAULT NULL,
  status          ENUM('submitted','in_review','approved','rejected','cancelled') NOT NULL DEFAULT 'submitted',
  decision        ENUM('pending','accepted','rejected','cancelled') NOT NULL DEFAULT 'pending',
  approver_1_status ENUM('pending','accepted','rejected') NOT NULL DEFAULT 'pending',
  decided_by      INT UNSIGNED DEFAULT NULL,
  decided_at      TIMESTAMP NULL DEFAULT NULL,
  decision_note   TEXT DEFAULT NULL,
  printed_at      DATE DEFAULT NULL,
  anomaly_flag    VARCHAR(100) DEFAULT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_service_requests_legacy (legacy_table, legacy_id),
  KEY idx_service_requests_type (service_type, status),
  KEY idx_service_requests_user (user_id),
  CONSTRAINT fk_service_requests_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Nilai spesifik jenis layanan yang tidak layak jadi kolom di service_requests.
CREATE TABLE IF NOT EXISTS service_request_fields (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_id   INT UNSIGNED NOT NULL,
  field_key    VARCHAR(75) NOT NULL,
  field_value  TEXT DEFAULT NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_service_fields (request_id, field_key),
  CONSTRAINT fk_service_fields_request FOREIGN KEY (request_id) REFERENCES service_requests (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dokumen berlabel per layanan: menggantikan ratusan kolom file_* dan tabel *_dokumen.
CREATE TABLE IF NOT EXISTS service_documents (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_id   INT UNSIGNED NOT NULL,
  label        VARCHAR(75) NOT NULL,
  legacy_field VARCHAR(75) DEFAULT NULL,
  document_id  INT UNSIGNED DEFAULT NULL,
  legacy_path  VARCHAR(512) DEFAULT NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_service_documents (request_id, label),
  KEY idx_service_documents_document (document_id),
  CONSTRAINT fk_service_documents_request FOREIGN KEY (request_id) REFERENCES service_requests (id) ON DELETE CASCADE,
  CONSTRAINT fk_service_documents_document FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS service_request_checks (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_id   INT UNSIGNED NOT NULL,
  check_type   VARCHAR(50) NOT NULL,
  result       VARCHAR(50) DEFAULT NULL,
  notes        TEXT DEFAULT NULL,
  checked_by   INT UNSIGNED DEFAULT NULL,
  checked_at   TIMESTAMP NULL DEFAULT NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_service_checks_request (request_id),
  CONSTRAINT fk_service_checks_request FOREIGN KEY (request_id) REFERENCES service_requests (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS generated_letters (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  letter_type  ENUM('sphd','sppid','sk','suket','buku_cuti','sptjm','piagam','other') NOT NULL,
  entity_table VARCHAR(75) NOT NULL,
  entity_id    INT UNSIGNED NOT NULL,
  number       VARCHAR(100) DEFAULT NULL,
  document_id  INT UNSIGNED DEFAULT NULL,
  issued_at    DATE DEFAULT NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_generated_letters_entity (entity_table, entity_id),
  CONSTRAINT fk_generated_letters_document FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
