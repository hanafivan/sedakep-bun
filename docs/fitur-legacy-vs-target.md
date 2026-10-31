# Fitur Legacy Sedakep vs Codebase Hono

Daftar lengkap fitur yang ADA di legacy `sedakep-ptsp-kemenag-sleman` tapi BELUM ada di
`codebase-hono`. Sumber: `include/menu.php`, `admin.php` (routing `?page=`), `disposisi/referensi.php`
yang dirujuk, dan seluruh direktori modul.

Skala legacy: ~105.000 baris PHP, 58 tabel. Skala target saat ini: 4 modul (leave, user,
documents, admin), 8 halaman web — semuanya hanya sekitar cuti.

---

## 1. Modul layanan kepegawaian — 16 modul, 0% diport

Total ~80.900 baris PHP. Semua tabel targetnya sudah dibuat di Fase 12 tapi **isinya 0 baris**
dan belum ada route/service sama sekali.

| # | Modul | Menu legacy | Baris PHP | Tabel legacy | Isi | Tabel target (kosong) |
|---|---|---|---|---|---|---|
| 1 | Disposisi surat masuk | Kinerja → Disposisi | 7.927 | `hlm_edispo`, `_acc`, `_disposisi`, `_final`, `_klasifikasi` | 6.790 | `dispositions`, `disposition_finals`, `incoming_letters`, `incoming_letter_references` |
| 2 | Alibi | Kinerja → Alibi | 4.286 | `hlm_alibi`, `_acc` | 6.057 | `alibi_requests` |
| 3 | Surat Tugas | Kinerja → Surat Tugas | 4.330 | `hlm_surtug`, `_acc`, `_ket`, `_peg`, `_tembus` | 3.194 | `assignment_letters`, `_members`, `_copies`, `_notes` |
| 4 | Agenda | Kinerja → Agenda | 1.096 | `hlm_agenda` | 2.484 | `agendas` |
| 5 | Pangkat (JFT/JFU/STRK) | *disembunyikan* (`pgt_off`) | 11.524 | `hlm_pangkat`, `_jft`, `_jfu`, `_strk` | 13 | — |
| 6 | Ijin Belajar | Layanan → Usul Ijin Belajar | 7.714 | `hlm_ibel`, `_acc`, `_sphd` | 72 | `service_requests` (kind) |
| 7 | Pensiun | Layanan → Usul Pensiun | 5.440 | `hlm_pens_reg_usul`, `_acc`, `_suket` | 302 | `service_requests` (kind) |
| 8 | Satya Lencana | Kartu → Usul Satya Lencana | 4.944 | `hlm_satlen`, `_acc`, `_sphd` | 174 | `service_requests` (kind) |
| 9 | Gelar | Layanan → Usul Pencantuman Gelar | 4.355 | `hlm_gelar`, `_acc` | 173 | `service_requests` (kind) |
| 10 | BPJS | Kartu → Usul Kartu BPJS | 4.368 | `hlm_bpjs`, `_acc` | 306 | `service_requests` (kind) |
| 11 | Taspen | Kartu → Usul Kartu Taspen | 3.573 | `hlm_taspen`, `_acc` | 39 | `service_requests` (kind) |
| 12 | Karis/Karsu | Kartu → Usul Kartu Istri/Suami | 3.556 | `hlm_karisu`, `_acc` | 210 | `service_requests` (kind) |
| 13 | KARPEG | *disembunyikan* (`kpg_off`) | 2.767 | `hlm_karpeg`, `_acc` | 7 | — |
| 14 | Tugas Belajar | Layanan → Usul Tugas Belajar | 1.416 | `tugas_belajar`, `_acc` | 8 | `service_requests` (kind) |
| 15 | PMK | Layanan → Usul PMK | 824 | `tbl_pmk`, `_acc` | 0 | `service_requests` (kind) |
| 16 | SKMI/SKPP | Layanan → Usul SKMI/SKPP | 767 | `tbl_skmi_skpp`, `_acc` | 0 | `service_requests` (kind) |

Pola tiap modul sama: **tambah → edit → hapus → upload dokumen (banyak jenis per modul) →
approval atasan → daftar → cetak**. Contoh ijin belajar punya 28 jenis upload
(upload_ijazah, upload_skp1, upload_rekom, dst); pangkat punya 43. Modul dokumen di target
hanya bisa membaca (list + presigned download), belum menerima unggahan.

## 2. Cuti — sudah ada tapi baru satu jenis dan baru sebagian alur

Yang sudah jalan: pengajuan cuti tahunan, approval berjenjang (admin + atasan 1 + atasan 2),
kuota, projection, frontend.

Yang belum ada:

| Fitur | Berkas legacy | Catatan |
|---|---|---|
| 5 jenis cuti lain | — | legacy punya: Cuti Sakit (2.238), Alasan Penting (259), Besar (118), Melahirkan (78), Di Luar Tanggungan Negara (1). Target baru Cuti Tahunan. |
| Formulir pengajuan mintahun | `tambah_surat_masuk_mintahunan.php` | jalur pengajuan khusus pegawai yang baru memenuhi syarat (1.736 baris) |
| Formulir pengajuan nonaktif | `tambah_surat_masuk_nonaktif.php` | jalur untuk pegawai nonaktif |
| Surat keterangan cuti | `surat_keterangan.php`, `tambah_suket.php`, `edit_suket.php`, `hapus_suket.php`, `tbl_suket` | 3.367 baris. Nomor surat + `file_sk` per permohonan |
| Upload SK cuti | `upload_sk.php`, `lihat_sk.php` | approval menandatangani SK lalu diunggah balik |
| Surat keterangan madrasah | `suket_madrasah.php`, `tambah_suketmad.php`, `edit_suketmad.php`, `tbl_suketmad` | 596 baris |
| Arsip per status | `cuti_jadi.php`, `ditolak.php`, `dibatalkan.php`, `belum_diperiksa.php`, `belum_kirim.php` | 5 halaman daftar terpisah (~2.900 baris) |
| Buku cuti | `buku_cuti.php`, `buku_cuti_awal.php`, `cetak_buku_cuti.php` | rekap saldo cuti per pegawai, bisa dicetak |
| FAQ Cuti PNS | `faq_cuti.php` | halaman informasi |
| Upload lampiran oleh pemohon | `tambah_surat_masuk.php` baris 510 | target belum punya `POST /documents` |
| Periode tutup tahunan | `include/cuti_tahunan_tutup.php` | backend sudah ada (`leave_closure_periods`), 1 baris hard-code 2025 |
| Kelola kuota per user | `admin_kuota_user.php` (618 baris) | admin mengubah saldo pegawai |
| Pengaturan kuota cuti | `admin_cuti_settings.php` (364 baris) | kuota default, SK Presiden, log perubahan |
| Validasi TMT PPPK | `admin_validasi_tmt.php` (294 baris) | memutuskan TMT hasil parse NIP benar/tidak |

## 3. Cetak, PDF, dan QR — 0% diport (belum mulai, Fase 13)

Semua masih PHP + FPDF + phpqrcode (`phpfpdf/`, `phpqrcode/`).

| Output | Berkas legacy |
|---|---|
| Formulir permohonan cuti | `cetak.php`, `cetak_pdf.php` |
| SK cuti (+ lampiran QR) | `cetak_sk.php`, `cetak_sk_pdf.php`, `cetak_sk_pdf_22.php`, `include/cuti_sk.php` |
| Buku cuti | `cetak_buku_cuti.php` |
| Surat tugas | `cetak_surtug.php` |
| Alibi | `cetak_alibi.php` |
| Disposisi | `cetak_dispo.php`, `cetak_dispo_awal.php`, `generateqrimage.php` |
| SPHD (hasil uji dinas) | `cetak_sphd.php`, `sphd_cetak.php`, `sphd_tambah.php`, `sphd.php` |
| SPPID pensiun | `cetak_sppid.php` |

Catatan: QR dipakai untuk tanda tangan disposisi, **belum ada halaman verifikasi publik**
untuk memindai QR-nya. Tabel `generated_letters` di target sudah dibuat, 0 baris.

## 4. Pengaturan dan administrasi

| Fitur | Berkas legacy | Status di target |
|---|---|---|
| Identitas instansi (nama, alamat, logo, website, status) | `pengaturan.php`, `tbl_instansi` | **Belum ada.** Tabel `settings` kosong. Dipakai di sidebar dan kemungkinan kop surat |
| Referensi klasifikasi surat (CRUD) | tujuan `?page=ref` → `referensi.php` | **Belum ada.** Di legacy pun halamannya rusak (berkasnya tidak ada); tabel `tbl_klasifikasi` 3 baris, target `letter_classifications` 0 |
| Backup database | `pengaturan.php?sub=back`, `backup.php`, `functions.php:backup()` | **Belum ada** |
| Restore database | `pengaturan.php?sub=rest`, `restore.php`, `functions.php:restore()` | **Belum ada** |
| Ubah password sendiri | `profil.php?sub=pass` | Ada (`PUT /users/me/password`) |
| Reset password user oleh admin | `reset_password.php` | Ada (`POST /users/{id}/reset-password`) |
| Ubah tipe/role user | `edit_tipe_user.php` (315 baris) | Belum sepenuhnya — lihat bagian 5 |
| Profil pegawai | `profil.php` | Sebagian, belum ada halaman profil |
| Panduan PDF dan video | tautan Google Drive + YouTube | Belum ada (eksternal) |

## 5. Hak akses — pemetaan role hilang

Legacy punya 5 tingkat di kolom `tbl_user.admin`, target hanya 4 role.

| Legacy | Jumlah | Arti | Padanan target |
|---|---|---|---|
| 1 | 14 | Super Admin, akses penuh | `admin` |
| 2 | 1.698 | User biasa | `pegawai` |
| 4 | 13 | Admin Unit Kerja | **tidak ada padanan** |
| 5 | 3 | Admin eDispo / TTE | **tidak ada padanan** |
| 6 | 2 | Admin Presensi | **tidak ada padanan** |

Yang hilang akibatnya: scoping data per unit kerja (Admin Unit Kerja hanya melihat unitnya),
peran khusus disposisi/TTE, dan peran presensi. Target hanya `pegawai|verifikator|atasan|admin`.

## 6. Operasional dan teknis

| Fitur | Berkas legacy | Catatan |
|---|---|---|
| Reset kuota tahunan otomatis | `cron_reset_cuti.php` | di target belum ada penjadwalan; rollover juga belum ada |
| Deployment | `Dockerfile`, `docker-compose.yml`, `docker/`, `Jenkinsfile` | target pakai Bun; ini tidak perlu diport, hanya perlu deployment baru |
| Script migrasi internal legacy | `apply_migration.php`, `migration_*.php/sql` (≈20 berkas) | alat sekali pakai, tidak perlu diport |
| Verifikasi tautan dokumen | `include/functions.php: doc_link_validate()`, `doc_href()` | tidak relevan lagi setelah MinIO |

---

## Ringkasan angka

- Modul layanan kepegawaian: **16 modul, 0 diport** (~80.900 baris PHP, ~23.800 baris data).
- Fitur cuti yang belum lengkap: **15 item**.
- Output cetak/PDF/QR: **8 jenis, 0 diport**.
- Pengaturan/administrasi: **7 item belum ada**, 2 sudah ada, 1 sebagian.
- Role: **3 dari 5 tingkat legacy tidak punya padanan**.

Kalau diurutkan berdasarkan jumlah data yang menunggu: Surat Tugas (3.194 + 21.294 baris
relasi) → Disposisi (6.790 + 6.776) → Alibi (6.057) → Surat Keterangan (3.963) → Agenda (2.484).
