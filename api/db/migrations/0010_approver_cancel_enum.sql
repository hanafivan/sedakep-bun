-- Konsistensi enum keputusan approval.
--
-- `admin_decision` sudah punya 'cancelled', tetapi approver_1/2_status belum.
-- Ditemukan lewat data legacy: approver_2_status berisi nilai 'Dibatalkan'
-- (lihat 0009). Samakan supaya pembatalan di level atasan tidak ditolak MySQL.
SET NAMES utf8mb4;

ALTER TABLE leave_requests
  MODIFY COLUMN approver_1_status ENUM('pending','accepted','rejected','cancelled') NOT NULL DEFAULT 'pending',
  MODIFY COLUMN approver_2_status ENUM('pending','accepted','rejected','cancelled') NOT NULL DEFAULT 'pending';
