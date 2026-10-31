-- Perbaiki indeks uq_leave_letters_legacy agar mencakup letter_type
-- karena tbl_suket dan tbl_suketmad sama-sama memiliki ID auto-increment dari 1.
SET NAMES utf8mb4;

ALTER TABLE leave_letters
  DROP INDEX uq_leave_letters_legacy,
  ADD UNIQUE KEY uq_leave_letters_legacy (legacy_id, letter_type);
