-- Penomoran surat: hilangkan AUTO_INCREMENT supaya LAST_INSERT_ID(expr) bisa
-- dipakai sebagai penomoran atomik tanpa perlu membaca ulang tabel.
--
-- Dengan AUTO_INCREMENT, MySQL menimpa nilai LAST_INSERT_ID dengan id baris yang
-- baru dibuat, sehingga trik LAST_INSERT_ID(expr) tidak dapat dipercaya.
-- Kunci primer (letter_type, year) sudah cukup unik untuk tabel ini.
SET NAMES utf8mb4;

DROP TABLE IF EXISTS leave_letter_counters;

CREATE TABLE leave_letter_counters (
  letter_type ENUM('suket','suket_madrasah') NOT NULL,
  year        YEAR NOT NULL,
  last_number INT  NOT NULL DEFAULT 0,
  PRIMARY KEY (letter_type, year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
