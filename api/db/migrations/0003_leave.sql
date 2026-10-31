-- Cuti: permohonan, kebijakan tahunan, projection kuota, audit mutasi.
-- Approval current-state dilipat ke leave_requests (legacy tbl_acc terbukti 1:1).
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS leave_requests (
  id                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
  legacy_id          VARCHAR(64)  DEFAULT NULL,
  user_id            INT UNSIGNED NOT NULL,
  legacy_user_id     INT UNSIGNED DEFAULT NULL,

  -- snapshot identitas saat mengajukan
  name               VARCHAR(120) NOT NULL,
  nip                VARCHAR(18)  DEFAULT NULL,
  grade              VARCHAR(20)  DEFAULT NULL,
  position           VARCHAR(150) DEFAULT NULL,
  organization_name  VARCHAR(150) DEFAULT NULL,
  service_years      VARCHAR(30)  DEFAULT NULL,

  leave_type         VARCHAR(40)  NOT NULL,
  duration           INT          NOT NULL,
  duration_unit      ENUM('day','month','year') NOT NULL DEFAULT 'day',
  start_date         DATE         NOT NULL,
  end_date           DATE         NOT NULL,
  reason             VARCHAR(500) DEFAULT NULL,
  address            TEXT         DEFAULT NULL,
  phone              VARCHAR(30)  DEFAULT NULL,

  -- snapshot pejabat penanda tangan
  approver_1_name    VARCHAR(150) DEFAULT NULL,
  approver_1_nip     VARCHAR(18)  DEFAULT NULL,
  approver_1_position VARCHAR(150) DEFAULT NULL,
  approver_2_name    VARCHAR(150) DEFAULT NULL,
  approver_2_nip     VARCHAR(18)  DEFAULT NULL,
  approver_2_position VARCHAR(150) DEFAULT NULL,

  -- status & approval (current-state)
  status             ENUM('submitted','in_review','approved','rejected','cancelled') NOT NULL DEFAULT 'submitted',
  admin_decision     ENUM('pending','accepted','rejected','cancelled') NOT NULL DEFAULT 'pending',
  approver_1_status  ENUM('pending','accepted','rejected') NOT NULL DEFAULT 'pending',
  approver_2_status  ENUM('pending','accepted','rejected') NOT NULL DEFAULT 'pending',
  admin_decided_by   INT UNSIGNED DEFAULT NULL,
  admin_decided_at   TIMESTAMP    NULL DEFAULT NULL,
  approver_1_id      INT UNSIGNED DEFAULT NULL,
  approver_1_decided_at TIMESTAMP NULL DEFAULT NULL,
  approver_2_id      INT UNSIGNED DEFAULT NULL,
  approver_2_decided_at TIMESTAMP NULL DEFAULT NULL,
  rejection_reason   VARCHAR(500) DEFAULT NULL,

  -- snapshot kuota legacy di tbl_acc (dipakai tampilan lama)
  legacy_quota_n     INT DEFAULT NULL,
  legacy_quota_n1    INT DEFAULT NULL,
  legacy_quota_n2    INT DEFAULT NULL,
  legacy_note_n      VARCHAR(50) DEFAULT NULL,
  legacy_note_n1     VARCHAR(50) DEFAULT NULL,
  legacy_note_n2     VARCHAR(50) DEFAULT NULL,

  anomaly_flag       VARCHAR(100) DEFAULT NULL,
  submitted_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_leave_requests_legacy (legacy_id),
  KEY idx_leave_user_year (user_id, start_date),
  KEY idx_leave_type_status (leave_type, status),
  KEY idx_leave_start (start_date),
  KEY idx_leave_user_type (user_id, leave_type),
  CONSTRAINT fk_leave_requests_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_leave_admin_actor FOREIGN KEY (admin_decided_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS leave_policies (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  year             YEAR         NOT NULL,
  default_days     INT          NOT NULL DEFAULT 12,
  days_after_sk    INT          NOT NULL DEFAULT 12,
  sk_applied       TINYINT(1)   NOT NULL DEFAULT 0,
  sk_applied_at    DATE         DEFAULT NULL,
  notes            TEXT         DEFAULT NULL,
  carry_over_max_n1 TINYINT UNSIGNED NOT NULL DEFAULT 6,
  carry_over_max_n2 TINYINT UNSIGNED NOT NULL DEFAULT 6,
  min_service_months TINYINT UNSIGNED NOT NULL DEFAULT 12,
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_leave_policies_year (year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS leave_closure_periods (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  year       YEAR         NOT NULL,
  start_date DATE         NOT NULL,
  end_date   DATE         NOT NULL,
  enabled    TINYINT(1)   NOT NULL DEFAULT 1,
  message    VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_leave_closure_range (start_date, end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS leave_quotas (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id         INT UNSIGNED NOT NULL,
  year            YEAR         NOT NULL,
  quota_n         INT NOT NULL DEFAULT 12,
  quota_n1        INT NOT NULL DEFAULT 0,
  quota_n2        INT NOT NULL DEFAULT 0,
  total_quota     INT NOT NULL DEFAULT 12,
  used_n          INT NOT NULL DEFAULT 0,
  used_n1         INT NOT NULL DEFAULT 0,
  used_n2         INT NOT NULL DEFAULT 0,
  total_used      INT NOT NULL DEFAULT 0,
  remaining_n     INT NOT NULL DEFAULT 12,
  remaining_n1    INT NOT NULL DEFAULT 0,
  remaining_n2    INT NOT NULL DEFAULT 0,
  total_remaining INT NOT NULL DEFAULT 12,
  reserved_days   INT NOT NULL DEFAULT 0,
  reserved_count  INT NOT NULL DEFAULT 0,
  eligible        TINYINT(1) NOT NULL DEFAULT 1,
  months_worked   INT DEFAULT NULL,
  tmt_year        INT DEFAULT NULL,
  tmt_month       INT DEFAULT NULL,
  manual_validation TINYINT(1) NOT NULL DEFAULT 0,
  override_reason VARCHAR(255) DEFAULT NULL,
  computed_at     TIMESTAMP NULL DEFAULT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_leave_quotas_user_year (user_id, year),
  KEY idx_leave_quotas_year (year),
  CONSTRAINT fk_leave_quotas_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS leave_quota_audits (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id        INT UNSIGNED NOT NULL,
  quota_id       INT UNSIGNED DEFAULT NULL,
  leave_request_id INT UNSIGNED DEFAULT NULL,
  year           YEAR         DEFAULT NULL,
  action         ENUM('rebuild','deduct','rollover','sk_applied','admin_override','large_leave','init','correction') NOT NULL,
  before_data    JSON DEFAULT NULL,
  after_data     JSON DEFAULT NULL,
  difference     INT DEFAULT NULL,
  actor_id       INT UNSIGNED DEFAULT NULL,
  reason         VARCHAR(500) DEFAULT NULL,
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_leave_audit_user (user_id, year),
  KEY idx_leave_audit_action (action),
  KEY idx_leave_audit_created (created_at),
  CONSTRAINT fk_leave_audit_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_leave_audit_quota FOREIGN KEY (quota_id) REFERENCES leave_quotas (id) ON DELETE SET NULL,
  CONSTRAINT fk_leave_audit_request FOREIGN KEY (leave_request_id) REFERENCES leave_requests (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
