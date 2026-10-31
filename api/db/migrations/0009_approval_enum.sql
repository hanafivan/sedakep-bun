-- Legacy membedakan "Dibatalkan" pada approval per tingkat, bukan hanya di admin.
-- ENUM approval per tingkat harus memuat 'cancelled' supaya status itu tidak terpotong.
SET NAMES utf8mb4;

ALTER TABLE leave_requests
  MODIFY COLUMN approver_1_status ENUM('pending','accepted','rejected','cancelled') NOT NULL DEFAULT 'pending',
  MODIFY COLUMN approver_2_status ENUM('pending','accepted','rejected','cancelled') NOT NULL DEFAULT 'pending';

ALTER TABLE alibi_requests
  MODIFY COLUMN approver_1_status ENUM('pending','accepted','rejected','cancelled') NOT NULL DEFAULT 'pending',
  MODIFY COLUMN approver_2_status ENUM('pending','accepted','rejected','cancelled') NOT NULL DEFAULT 'pending';

ALTER TABLE service_requests
  MODIFY COLUMN approver_1_status ENUM('pending','accepted','rejected','cancelled') NOT NULL DEFAULT 'pending';
