-- Surat masuk umum, klasifikasi, disposisi ke pelaksana, dan finalisasi.
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS letter_classifications (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  legacy_id  VARCHAR(64) DEFAULT NULL,
  code       VARCHAR(50) NOT NULL,
  name       VARCHAR(200) NOT NULL,
  description TEXT DEFAULT NULL,
  is_active  TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_letter_classifications_code (code),
  UNIQUE KEY uq_letter_classifications_legacy (legacy_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS incoming_letters (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  legacy_id       VARCHAR(64) DEFAULT NULL,
  created_by      INT UNSIGNED DEFAULT NULL,
  owner_name      VARCHAR(120) DEFAULT NULL,
  owner_nip       VARCHAR(18)  DEFAULT NULL,
  agenda_number   VARCHAR(50)  DEFAULT NULL,
  ticket_number   VARCHAR(50)  DEFAULT NULL,
  letter_number   VARCHAR(100) DEFAULT NULL,
  origin          VARCHAR(200) DEFAULT NULL,
  content         TEXT DEFAULT NULL,
  classification_code VARCHAR(50) DEFAULT NULL,
  index_code      VARCHAR(50)  DEFAULT NULL,
  letter_date     DATE DEFAULT NULL,
  received_date   DATE DEFAULT NULL,
  notes           TEXT DEFAULT NULL,
  status          ENUM('baru','didisposisi','selesai','arsip') NOT NULL DEFAULT 'baru',
  finalized_at    TIMESTAMP NULL DEFAULT NULL,
  anomaly_flag    VARCHAR(100) DEFAULT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_incoming_letters_legacy (legacy_id),
  KEY idx_incoming_letters_number (letter_number),
  KEY idx_incoming_letters_date (received_date),
  KEY idx_incoming_letters_status (status),
  CONSTRAINT fk_incoming_letters_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dispositions (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  legacy_id      VARCHAR(64) DEFAULT NULL,
  incoming_letter_id INT UNSIGNED NOT NULL,
  target_name    VARCHAR(150) DEFAULT NULL,
  target_nip     VARCHAR(18)  DEFAULT NULL,
  instruction    TEXT DEFAULT NULL,
  notes          TEXT DEFAULT NULL,
  sort_order     INT NOT NULL DEFAULT 0,
  status         ENUM('pending','accepted','done','rejected') NOT NULL DEFAULT 'pending',
  decided_at     TIMESTAMP NULL DEFAULT NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_dispositions_legacy (legacy_id),
  KEY idx_dispositions_letter (incoming_letter_id),
  CONSTRAINT fk_dispositions_letter FOREIGN KEY (incoming_letter_id) REFERENCES incoming_letters (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS disposition_finals (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  legacy_id      VARCHAR(64) DEFAULT NULL,
  incoming_letter_id INT UNSIGNED NOT NULL,
  name           VARCHAR(150) DEFAULT NULL,
  nip            VARCHAR(18)  DEFAULT NULL,
  instruction    TEXT DEFAULT NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_disposition_finals_legacy (legacy_id),
  KEY idx_disposition_finals_letter (incoming_letter_id),
  CONSTRAINT fk_disposition_finals_letter FOREIGN KEY (incoming_letter_id) REFERENCES incoming_letters (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS incoming_letter_references (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  incoming_letter_id INT UNSIGNED NOT NULL,
  reference_text VARCHAR(255) DEFAULT NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_incoming_refs_letter (incoming_letter_id),
  CONSTRAINT fk_incoming_refs_letter FOREIGN KEY (incoming_letter_id) REFERENCES incoming_letters (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
