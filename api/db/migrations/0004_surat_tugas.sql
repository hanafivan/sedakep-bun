-- Surat tugas: surat + anggota (1:N) + keterangan (1:N) + tembusan (1:N) + approval.
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS assignment_letters (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  legacy_id      VARCHAR(64) DEFAULT NULL,
  user_id        INT UNSIGNED NOT NULL,
  code           VARCHAR(50)  DEFAULT NULL,
  letter_number  VARCHAR(100) DEFAULT NULL,
  consideration  TEXT DEFAULT NULL,
  legal_basis    TEXT DEFAULT NULL,
  content        TEXT DEFAULT NULL,
  start_date     DATE DEFAULT NULL,
  end_date       DATE DEFAULT NULL,
  day_start      VARCHAR(30) DEFAULT NULL,
  day_end        VARCHAR(30) DEFAULT NULL,
  place          VARCHAR(150) DEFAULT NULL,
  time_start     VARCHAR(10) DEFAULT NULL,
  time_end       VARCHAR(10) DEFAULT NULL,
  signer_name    VARCHAR(150) DEFAULT NULL,
  signer_position VARCHAR(150) DEFAULT NULL,
  footnote       TEXT DEFAULT NULL,
  printed_at     DATE DEFAULT NULL,
  status         ENUM('submitted','in_review','approved','rejected','cancelled') NOT NULL DEFAULT 'submitted',
  decision       ENUM('pending','accepted','rejected') NOT NULL DEFAULT 'pending',
  decided_by     INT UNSIGNED DEFAULT NULL,
  decided_at     TIMESTAMP NULL DEFAULT NULL,
  decision_note  TEXT DEFAULT NULL,
  anomaly_flag   VARCHAR(100) DEFAULT NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_assignment_letters_legacy (legacy_id),
  KEY idx_assignment_letters_user (user_id),
  KEY idx_assignment_letters_number (letter_number),
  CONSTRAINT fk_assignment_letters_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS assignment_members (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  legacy_id     VARCHAR(64) DEFAULT NULL,
  letter_id     INT UNSIGNED NOT NULL,
  name          VARCHAR(150) NOT NULL,
  nip           VARCHAR(18)  DEFAULT NULL,
  grade         VARCHAR(20)  DEFAULT NULL,
  position      VARCHAR(150) DEFAULT NULL,
  organization_name VARCHAR(150) DEFAULT NULL,
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_assignment_members_legacy (legacy_id),
  KEY idx_assignment_members_letter (letter_id),
  CONSTRAINT fk_assignment_members_letter FOREIGN KEY (letter_id) REFERENCES assignment_letters (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS assignment_notes (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  legacy_id  VARCHAR(64) DEFAULT NULL,
  letter_id  INT UNSIGNED NOT NULL,
  note       TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_assignment_notes_legacy (legacy_id),
  KEY idx_assignment_notes_letter (letter_id),
  CONSTRAINT fk_assignment_notes_letter FOREIGN KEY (letter_id) REFERENCES assignment_letters (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS assignment_copies (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  legacy_id  VARCHAR(64) DEFAULT NULL,
  letter_id  INT UNSIGNED NOT NULL,
  copy_to    VARCHAR(200) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_assignment_copies_legacy (legacy_id),
  KEY idx_assignment_copies_letter (letter_id),
  CONSTRAINT fk_assignment_copies_letter FOREIGN KEY (letter_id) REFERENCES assignment_letters (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
