-- Penyimpanan dokumen: metadata object MinIO + link polimorfik.
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS documents (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  bucket            VARCHAR(100) NOT NULL,
  object_key        VARCHAR(512) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  mime_type         VARCHAR(150) DEFAULT NULL,
  extension         VARCHAR(20)  DEFAULT NULL,
  size_bytes        BIGINT UNSIGNED DEFAULT NULL,
  sha256            CHAR(64)     DEFAULT NULL,
  checksum_verified TINYINT(1)   NOT NULL DEFAULT 0,
  status            ENUM('pending','uploading','stored','verified','failed','missing') NOT NULL DEFAULT 'pending',
  uploaded_by       INT UNSIGNED DEFAULT NULL,
  created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_documents_object (bucket, object_key),
  KEY idx_documents_sha (sha256),
  KEY idx_documents_status (status),
  CONSTRAINT fk_documents_uploader FOREIGN KEY (uploaded_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Link ke banyak entity tanpa puluhan kolom file: entity_table + entity_id.
CREATE TABLE IF NOT EXISTS document_links (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  document_id     INT UNSIGNED NOT NULL,
  entity_table    VARCHAR(75)  NOT NULL,
  entity_id       INT UNSIGNED NOT NULL,
  field           VARCHAR(75)  NOT NULL DEFAULT 'file',
  label           VARCHAR(150) DEFAULT NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_document_links (entity_table, entity_id, field, document_id),
  KEY idx_document_links_entity (entity_table, entity_id),
  CONSTRAINT fk_document_links_document FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_id     INT UNSIGNED DEFAULT NULL,
  action       VARCHAR(75)  NOT NULL,
  entity_table VARCHAR(75)  NOT NULL,
  entity_id    INT UNSIGNED DEFAULT NULL,
  before_data  JSON         DEFAULT NULL,
  after_data   JSON         DEFAULT NULL,
  ip_address   VARCHAR(45)  DEFAULT NULL,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_entity (entity_table, entity_id),
  KEY idx_audit_actor (actor_id),
  KEY idx_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS legacy_mappings (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  legacy_table  VARCHAR(75)  NOT NULL,
  legacy_pk     VARCHAR(64)  NOT NULL,
  target_table  VARCHAR(75)  NOT NULL,
  target_id     INT UNSIGNED NOT NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_legacy_mapping (legacy_table, legacy_pk, target_table),
  KEY idx_legacy_target (target_table, target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS migration_items (
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  kind               ENUM('document','row','file') NOT NULL DEFAULT 'document',
  source_table       VARCHAR(75)  NOT NULL,
  source_column      VARCHAR(75)  DEFAULT NULL,
  source_record_id   VARCHAR(64)  NOT NULL,
  legacy_path        VARCHAR(512) DEFAULT NULL,
  fingerprint        CHAR(64)     DEFAULT NULL,
  file_size          BIGINT UNSIGNED DEFAULT NULL,
  document_id        INT UNSIGNED DEFAULT NULL,
  object_key         VARCHAR(512) DEFAULT NULL,
  status             ENUM('pending','uploaded','verified','failed','skipped_missing','orphan_file') NOT NULL DEFAULT 'pending',
  attempts           INT UNSIGNED NOT NULL DEFAULT 0,
  last_error         TEXT         DEFAULT NULL,
  verified_at        TIMESTAMP    NULL DEFAULT NULL,
  created_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_migration_identity (kind, source_table, source_column, source_record_id),
  KEY idx_migration_status (status),
  CONSTRAINT fk_migration_document FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
