-- Kelola kuota per bucket (N / N-1 / N-2).
--
-- Legacy `admin_kuota_user.php` menyunting `kuota_n`, `terpakai_n`, `sisa_n`
-- untuk ketiga tahun sekaligus. Di target, "terpakai" selalu diturunkan dari
-- histori permohonan (tidak boleh diisi manual tanpa double-count), tetapi
-- jatah per bucket tetap perlu bisa dikoreksi admin — mis. kuota tahun lalu
-- yang di legacy diisi 6 hari padahal seharusnya 12.
--
-- Karena itu penyesuaian diberi dimensi bucket. Baris lama otomatis menjadi
-- bucket 'n' (perilaku sebelumnya: delta hanya ke tahun berjalan).
SET NAMES utf8mb4;

ALTER TABLE leave_quota_adjustments
  ADD COLUMN bucket ENUM('n','n1','n2') NOT NULL DEFAULT 'n' AFTER year;

ALTER TABLE leave_quota_adjustments
  DROP INDEX idx_leave_adjust_user_year,
  ADD KEY idx_leave_adjust_user_year_bucket (user_id, year, bucket);
