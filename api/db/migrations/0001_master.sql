-- Master: organisasi, jabatan, user, dan data kepegawaian.
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS organizations (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  legacy_id    VARCHAR(64)  DEFAULT NULL,
  code         VARCHAR(50)  NOT NULL,
  name         VARCHAR(150) NOT NULL,
  parent_id    INT UNSIGNED DEFAULT NULL,
  level        TINYINT UNSIGNED NOT NULL DEFAULT 1,
  is_active    TINYINT(1)   NOT NULL DEFAULT 1,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_organizations_code (code),
  UNIQUE KEY uq_organizations_legacy (legacy_id),
  KEY idx_organizations_parent (parent_id),
  CONSTRAINT fk_organizations_parent FOREIGN KEY (parent_id) REFERENCES organizations (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS positions (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  legacy_id   VARCHAR(64)  DEFAULT NULL,
  name        VARCHAR(150) NOT NULL,
  grade       VARCHAR(20)  DEFAULT NULL,
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_positions_name (name),
  KEY idx_positions_legacy (legacy_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
  legacy_id          VARCHAR(64)  DEFAULT NULL,
  username           VARCHAR(75)  NOT NULL,
  password_hash      VARCHAR(255) NOT NULL,
  password_algo      ENUM('md5','bcrypt','argon2id') NOT NULL DEFAULT 'argon2id',
  must_rehash        TINYINT(1)   NOT NULL DEFAULT 0,
  name               VARCHAR(120) NOT NULL,
  nip                VARCHAR(18)  DEFAULT NULL,
  grade              VARCHAR(20)  DEFAULT NULL,
  position_id        INT UNSIGNED DEFAULT NULL,
  organization_id    INT UNSIGNED DEFAULT NULL,
  unit_name          VARCHAR(150) DEFAULT NULL,
  email              VARCHAR(150) DEFAULT NULL,
  phone              VARCHAR(30)  DEFAULT NULL,
  role               ENUM('pegawai','verifikator','atasan','admin') NOT NULL DEFAULT 'pegawai',
  is_admin           TINYINT(1)   NOT NULL DEFAULT 0,
  is_active          TINYINT(1)   NOT NULL DEFAULT 1,
  employment_type    ENUM('pns','pppk','unknown') NOT NULL DEFAULT 'unknown',
  tmt_date           DATE         DEFAULT NULL,
  last_login_at      TIMESTAMP    NULL DEFAULT NULL,
  created_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_legacy (legacy_id),
  KEY idx_users_nip (nip),
  KEY idx_users_org (organization_id),
  KEY idx_users_role (role),
  KEY idx_users_active (is_active),
  CONSTRAINT fk_users_position FOREIGN KEY (position_id) REFERENCES positions (id) ON DELETE SET NULL,
  CONSTRAINT fk_users_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS settings (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `key`        VARCHAR(75)  NOT NULL,
  value        TEXT         DEFAULT NULL,
  description  VARCHAR(255) DEFAULT NULL,
  updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_settings_key (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
