# Plan Utama Refactor Sedakep ke TypeScript + Hono

Codebase target: `/Users/hanafi/Pekerjaan/codebase-hono`
Source legacy: `/Applications/XAMPP/htdocs/sedakep-ptsp-kemenag-sleman`

Dokumen pendukung:

- Report utama: `docs/sedakep-migration-report.html`
- Report logic cuti: `docs/cuti-quota-logic-report.html`
- ERD legacy: `docs/sedakep-legacy-erd.svg`
- ERD target: `docs/sedakep-target-erd.svg`
- Audit gap per fase: `docs/fase-gap-audit.md`
- Fitur legacy vs target: `docs/fitur-legacy-vs-target.md`

> **Status ringkas (per 13 Okt 2026).** Fase 1–10 selesai. Fase 11 (frontend)
> **selesai**: 9.3 A1–A5 dikerjakan (CSS `tabs`/`faq`, helper `getQuotaFor`/
> `rebuildQuotaFor`, halaman `Letters.tsx` + `LeaveAdmin.tsx`, route + menu),
> gate C3 hijau, 4 berkas tes C1 ditambahkan, dan C4 diverifikasi lewat proxy Vite
> (lihat **9.9**). Migrasi data lanjutan (9.4 baris surat + Fase 10 berkas) dan
> keputusan 9.6 **ditunda atas keputusan pemilik** — fokus beralih ke port fitur
> (**Fase 12**, dimulai dari modul Surat tugas). Selisih 173 baris (9.6.2)
> **terbukti nol**: itu artefak estimasi InnoDB, bukan data hilang. Per 13 Okt 2026
> modul **Surat tugas** (fitur + cetak), **cetak Cuti**, **Alibi**, **Disposisi**,
> **Agenda**, dan **Layanan kepegawaian** (pensiun/gelar/karpeg/karis-karsu/BPJS/taspen/
> satya lencana/izin belajar/tugas belajar/PMK/SKMI-SKPP/pangkat) sudah selesai, plus
> **generator PDF + QR (Fase 13)** dan **artifact Fase 14**, plus **administrasi pengguna,
> profil, master data (organisasi/jabatan), halaman verifikasi QR, dan QR di cetak HTML**;
> gate `bun test` 161 lulus / 0 gagal. Eksekusi cutover menunggu keputusan go-live.

## 1. Fakta hasil audit

| Item | Hasil |
|---|---:|
| File PHP aplikasi | 382 |
| Baris PHP aplikasi | 105.822 |
| Tabel/view legacy | 59 |
| Kolom legacy | 855 |
| FK resmi | 6 |
| Relasi inferred | 86 |
| Kolom berisi file | 22 pada 20 tabel |
| Folder upload | 16 |
| `tbl_surat_masuk` | 7.926 permohonan |
| Cuti Tahunan | 5.232 permohonan |
| User | 1.730 |

## 2. Keputusan arsitektur

### Backend

- Runtime: Bun + Hono + TypeScript.
- Database: MySQL/MariaDB menggunakan `mysql2/promise`.
- Storage: MinIO/S3 menggunakan adapter yang sudah dibuat.
- Struktur lean: `route → validation → service → command/query → database`.
- SQL hanya berada di `command/` dan `query/`.
- Service berisi aturan bisnis, tanpa SQL.
- Tidak memakai repository, ORM, DDD, DI container, atau tabel approval 1:1 yang tidak diperlukan.

### Frontend

- React + TypeScript + Vite di folder `web/`.
- Frontend tidak menghitung saldo secara authoritative.
- Frontend hanya melakukan validasi UX, simulasi tampilan, dan memanggil API.

### Database

- Database target baru dengan nama dan kolom `snake_case` berbahasa Inggris.
- Database legacy dipertahankan read-only selama migrasi dan masa observasi.
- Approval current-state dilipat ke entity pemiliknya.
- Tabel terpisah hanya dipakai untuk relasi 1:N nyata atau data storage.

### File

- File baru langsung disimpan melalui MinIO.
- File legacy dipindahkan dengan object key deterministik.
- Legacy filesystem tetap menjadi fallback sementara: `MinIO → legacy filesystem → 404`.
- Migrasi file harus resumable, idempotent, dapat diulang, dan tidak membuat duplikat.

## 3. Keputusan khusus cuti dan kuota

`tbl_surat_masuk` adalah sumber transaksi permohonan cuti. Kuota resmi dihitung dari:

```text
leave_requests
  JOIN approval state pada request
  WHERE leave_type = Cuti Tahunan
    AND approval utama = Diterima
    AND approval atasan 1 = Diterima
    AND approval atasan 2 = Diterima
```

`tbl_cuti_quota` tidak menjadi sumber histori. Di target, tabel tersebut menjadi projection/cache yang dapat dibangun ulang kapan saja.

Engine canonical:

1. Ambil NIP dan resolve TMT.
2. User eligible setelah masa kerja minimal 12 bulan.
3. Ambil seluruh Cuti Tahunan final.
4. Kelompokkan penggunaan berdasarkan `YEAR(start_date)`.
5. Setiap tahun eligible mendapat pool 12 hari.
6. Kurangi dengan urutan N → N-1 → N-2.
7. Carry-over N-1 dan N-2 maksimum 6 hari pada tampilan.
8. Jika pool N-2 tersentuh, sisa pool N-2 hangus.
9. Available balance = official balance − reserved request.
10. Reserved adalah request Cuti Tahunan yang belum final dan belum ditolak, termasuk request tanpa approval record.

Aturan penting:

- Tahun transaksi berasal dari `tgl_mulai`/`start_date`, bukan tahun saat ini.
- Edit request harus mengecualikan request yang sedang diedit dari perhitungan.
- Non-Cuti Tahunan tidak mengurangi kuota Tahunan.
- Approval ulang tidak boleh menghitung dua kali.
- Perubahan final menjadi ditolak/dibatalkan harus mengembalikan saldo melalui rebuild.
- Engine replay adalah sumber kebenaran; mutasi snapshot tidak boleh menjadi satu-satunya mekanisme.

Temuan yang wajib ditangani saat migrasi:

- 6 `id_surat` memiliki lebih dari satu record `tbl_acc`.
- 4 record `tbl_acc` tidak memiliki parent `tbl_surat_masuk`.
- 31 request tidak memiliki record `tbl_acc` dan harus diperlakukan sebagai reserved.
- 8 Cuti Tahunan memiliki `lama_cuti <= 0`.
- Sebagian Cuti Tahunan memakai satuan `Tahun`, bukan `Hari`.
- `recalculateQuotaFromHistory()` memakai tabel `tbl_acc_atasan1` dan `tbl_acc_atasan2` yang tidak ada.
- Projection legacy tidak lengkap: quota hanya sekitar 202 user per tahun.
- Periode tutup cuti masih hard-code di source legacy.

## 4. Schema target utama

### 4.1 Master

- `users`
- `organizations`
- `positions`
- `employment_dates` atau field TMT pada user

### 4.2 Cuti

#### `leave_requests`

Menyimpan satu permohonan cuti:

- `id`, `legacy_id`, `user_id`
- snapshot nama, NIP, pangkat, jabatan, unit kerja, masa kerja
- `leave_type`, `duration`, `duration_unit`
- `start_date`, `end_date`, `reason`
- alamat selama cuti dan telepon
- snapshot pejabat level 1 dan level 2
- `status`
- status approval utama, level 1, level 2
- actor dan timestamp approval
- alasan penolakan
- `created_at`, `updated_at`

#### `leave_policies`

- tahun
- kuota default
- kuota setelah kebijakan/SK
- tanggal penerapan
- keterangan
- unique per tahun

#### `leave_quotas`

Projection per user dan tahun:

- kuota N, N-1, N-2
- pemakaian N, N-1, N-2
- sisa N, N-1, N-2
- total kuota, total terpakai, total sisa
- status eligibility, TMT, masa kerja
- manual override metadata
- unique `(user_id, year)`

#### `leave_quota_audits`

Audit perubahan projection/policy:

- action
- user, quota, request, actor
- nilai before/after
- selisih
- alasan
- timestamp

### 4.3 Workflow dan storage

- `dispositions`
- `assignment_members`
- `service_documents`
- `documents`
- `document_links`
- `audit_logs`
- `migration_items`

Tidak dibuat:

- `leave_approvals` untuk current approval 1:1
- `service_approvals` untuk current approval 1:1
- `migration_runs` sebagai tabel terpisah

## 5. Fase implementasi

### Fase 1 — Baseline dan kontrak perilaku

Deliverable:

- peta modul dan fitur legacy;
- mapping source-to-target;
- status workflow dan role matrix;
- enum jenis cuti, unit, approval, request status;
- kebijakan data anomali;
- keputusan timezone `Asia/Jakarta`;
- fixture hasil engine PHP terbaru.

Gate:

- semua modul legacy memiliki status: port, merge, retire, atau defer;
- tidak ada aturan penting yang hanya tersimpan di catatan informal;
- engine quota legacy terbaru dijadikan referensi parity test.

### Fase 2 — Schema target dan migration database

Deliverable:

- migration MySQL bernomor;
- schema master, cuti, workflow, storage, audit;
- index dan unique constraint;
- seed policy cuti;
- command migrate up/down.

Gate:

- database kosong dapat dimigrasikan ulang;
- migration aman dijalankan lebih dari sekali;
- seluruh field yang dibutuhkan engine sudah tersedia;
- typecheck dan test lulus.

### Fase 3 — Adapter runtime

Status: adapter dasar sudah dibuat.

Deliverable yang dipertahankan:

- `api/db/mysql.ts`;
- config terpusat;
- adapter MinIO/S3;
- local fallback;
- bucket healthcheck;
- presigned URL;
- protected object path;
- command `mysql:verify` dan `storage:verify`.

Gate:

- koneksi MariaDB terverifikasi;
- upload, download, HEAD, checksum, delete, dan presigned URL terverifikasi;
- `bun run typecheck` dan `bun test` lulus.

### Fase 4 — Pure quota engine

Buat module:

```text
api/modules/leave/
  domain/quota-engine.ts
  schema/index.ts
  schema/types.ts
  query/leave.query.ts
  query/quota.query.ts
  command/leave.command.ts
  command/approval.command.ts
  command/quota.command.ts
  service/leave.service.ts
  service/quota.service.ts
  leave.routes.ts
```

`quota-engine.ts` harus pure dan tidak berisi SQL. Fungsi minimal:

- resolve eligibility;
- build origin pools;
- replay official usage;
- calculate official balance;
- calculate reserved days;
- calculate available balance;
- map UI buckets;
- validate quota availability.

Gate:

- unit test untuk seluruh aturan N/N-1/N-2;
- test eligibility PNS, PPPK, missing TMT;
- test final, parsial, pending, ditolak, dibatalkan;
- parity test dengan fixture hasil PHP.

### Fase 5 — Read API

Endpoint minimal:

```text
GET  /api/leave-requests
GET  /api/leave-requests/:id
GET  /api/leave/quota?user_id=&year=
GET  /api/leave/quota/available?user_id=&year=
GET  /api/leave/quota/history?user_id=&year=
POST /api/leave/quota/rebuild
```

Response quota harus memisahkan:

- official balance;
- reserved days/count;
- available balance;
- eligibility;
- discrepancy atau anomaly flag.

Gate:

- SQL seluruhnya parameterized;
- service tidak mengandung SQL;
- response API cocok dengan fixture/report.

### Fase 6 — Create dan edit permohonan

Flow:

1. Validasi input.
2. Resolve user, TMT, jenis cuti, periode tutup.
3. Validasi file.
4. Lock scope user/tahun.
5. Hitung available, dengan exclude request saat edit.
6. Upload file ke temporary MinIO key.
7. Insert/update `leave_requests` dan `document_links`.
8. Commit transaction.
9. Hapus temporary object bila transaction gagal.

Gate:

- request melebihi available ditolak server-side;
- dua request paralel tidak oversubscribe saldo;
- edit tidak double count;
- upload gagal tidak meninggalkan request yatim.

### Fase 7 — Approval dan workflow

Endpoint:

```text
POST /api/leave-requests/:id/approve/admin
POST /api/leave-requests/:id/approve/level-1
POST /api/leave-requests/:id/approve/level-2
POST /api/leave-requests/:id/reject
POST /api/leave-requests/:id/cancel
```

Rules:

- role dan state transition tervalidasi;
- approval parsial tetap reserved;
- final approval memicu rebuild projection;
- reject/cancel setelah final memicu rebuild;
- approval retry idempotent;
- audit before/after tersimpan.

Gate:

- approval ulang tidak double count;
- perubahan status menghasilkan saldo yang benar;
- semua transisi ilegal ditolak.

### Fase 8 — Projection, rollover, policy, dan admin

Deliverable:

- rebuild per user/tahun;
- rebuild batch;
- rollover idempotent;
- konfigurasi kuota per tahun;
- penerapan SK/policy dengan audit;
- admin eligibility override;
- aturan Cuti Besar terpisah dan eksplisit.

Gate:

- rebuild berulang menghasilkan output sama;
- kegagalan satu user tidak membatalkan batch lain;
- policy tidak dapat diterapkan dua kali tanpa explicit correction;
- semua perubahan memiliki audit.

### Fase 9 — Migrasi data database

Urutan:

1. Import users dan mapping unit/jabatan.
2. Import `tbl_surat_masuk` → `leave_requests`.
3. Import `tbl_acc` → approval fields current-state.
4. Deduplicate approval dan catat konflik.
5. Import PPPK TMT.
6. Import settings/policy.
7. Rebuild `leave_quotas` dari histori request.
8. Generate discrepancy report CSV/HTML.

Identity:

```text
legacy:tbl_surat_masuk:{id_surat}
```

Gate:

- count source/target cocok atau setiap selisih punya alasan;
- orphan dan duplicate masuk laporan;
- user tanpa mapping tidak diam-diam hilang;
- official/reserved/available dibandingkan per user/tahun.

### Fase 10 — Migrasi dokumen ke MinIO

Untuk setiap kolom file yang direferensikan database:

- baca filesystem legacy tanpa menghapus source;
- buat key deterministik;
- hitung size dan SHA-256;
- gunakan HEAD sebelum upload;
- upload hanya jika belum ada atau fingerprint berbeda;
- verifikasi setelah upload;
- simpan metadata dan link setelah berhasil;
- catat missing dan orphan.

Contoh key:

```text
legacy/leave_requests/tbl_surat_masuk/{id_surat}/file/{filename}
```

Command target:

```text
bun run migrate:documents --dry-run
bun run migrate:documents --resume
bun run migrate:documents --retry-failed
bun run migrate:documents --verify
bun run migrate:documents --final-scan
```

Gate:

- retry tidak menggandakan object;
- migration dapat dilanjutkan dari checkpoint;
- checksum object cocok;
- seluruh link request → document valid;
- final scan menangkap file baru selama migrasi.

### Fase 11 — Frontend React

Halaman minimal:

- dashboard;
- daftar dan pencarian permohonan;
- form permohonan;
- informasi official/reserved/available quota;
- simulasi quota;
- detail permohonan dan approval timeline;
- approval admin/atasan;
- histori saldo;
- admin policy dan rebuild;
- migration/discrepancy report;
- preview/download dokumen.

Gate:

- `typecheck:web` lulus;
- `web:build` lulus;
- status pending tidak tampil sebagai final approved;
- quota frontend selalu berasal dari API;
- file diakses melalui endpoint terproteksi.

**Status: SELESAI.** Berkas: `web/src/api.ts` (klien tunggal + token), `web/src/auth.tsx`,
`web/src/format.ts`, `web/src/components/Layout.tsx`, `web/src/components/RequireAuth.tsx`,
`web/src/pages/{Login,Dashboard,LeaveList,LeaveForm,LeaveDetail,Quota,Approvals,Migration}.tsx`,
`web/src/styles.css`. Halaman lama scaffold (`App.tsx`, `Home.tsx`, `Register.tsx`) dihapus.

Gate terverifikasi: `typecheck:web` lulus, `web:build` lulus (289 kB / 89 kB gzip),
`bun test` 88 lulus, alur nyata diuji lewat HTTP (buat permohonan → reserved naik →
admin → level 1 → level 2 → final → reserved turun, rebuild projection).

Dua bug ditemukan lewat uji alur ini dan sudah diperbaiki:

1. `mysql2` mengembalikan kolom DATE sebagai objek Date pada zona waktu lokal, sehingga
   `YEAR(start_date)` di sisi aplikasi menjadi `NaN` — permohonan yang menunggu approval
   tidak pernah terhitung sebagai `reserved`. Perbaikan: `dateStrings: true` pada pool
   (`api/db/mysql.ts`) + normalisasi defensif `toDateOnly()` di
   `api/modules/leave/service/quota.service.ts`. Dijaga oleh `tests/leave-api.test.ts`.
2. Route approval atasan memakai segmen parsial `level-{level}`; terdaftar di OpenAPI
   tetapi tidak dikompilasi router Hono sehingga **selalu 404**. Diubah menjadi
   `/approve/level/{level}` di schema, klien `web/src/api.ts`, dan test OpenAPI.

Endpoint kuota kini per-user: `/leave/quota/{user_id}`, `/leave/quota/history/{user_id}`,
`/leave/quota/stored/{user_id}`, `/leave/quota/rebuild/{user_id}` — segmen boleh berisi
`me` sehingga frontend tidak perlu menebak identitas.

### Fase 12 — Port seluruh modul bisnis backend

Port dilakukan per modul. Setiap modul wajib dibaca dari source PHP, query SQL, tabel database, approval, upload, cetak, dan menu/permission. Tidak cukup memindahkan nama tabel saja.

Ringkasan volume source per modul:

| Modul | Folder | File | Baris |
|---|---|---:|---:|
| Surat tugas | `surattugas/` | 20 | 4.331 |
| Alibi | `alibi/` | 11 | 4.287 |
| Agenda | `agenda/` | 5 | 1.096 |
| Disposisi | `disposisi/` | 34 | 7.929 |
| Pensiun | `pensiun/` | 14 | 5.442 |
| Izin belajar | `ijinbelajar/` | 29 | 7.715 |
| Tugas belajar | `tugasbelajar/` | 6 | 1.416 |
| Gelar | `gelar/` | 17 | 4.355 |
| Karpeg | `karpeg/` | 11 | 2.767 |
| Karis/Karsu | `kariskarsu/` | 14 | 3.556 |
| BPJS | `bpjs/` | 17 | 4.368 |
| Pangkat | `pangkat/` | 45 | 11.524 |
| PMK | `pmk/` | 5 | 824 |
| Satya Lencana | `satyalencana/` | 20 | 4.945 |
| SKMI/SKPP | `skmi_skpp/` | 5 | 767 |
| Taspen | `taspen/` | 14 | 3.573 |
| Backup/restore | `backup/` | 14 | 5.357 |
| Cuti, surat masuk, suket | root | 78 file root | — |

#### 12.1 Master, auth, dan administrasi

Source: `index.php`, `loginadmin.php`, `logout.php`, `profil.php`, `user.php`, `tambah_user.php`, `hapus_user.php`, `reset_password.php`, `pengaturan.php`, `admin.php`, `include/menu.php`, `include/functions.php`.
Tabel: `tbl_user`, `tbl_admin`, `tbl_instansi`, `tbl_dept`, `tbl_jabatan`, `tbl_sett`, `tbl_pppk_tmt`.

Target: auth/session + compatibility password, `users`, `organizations`, `positions`, `settings`, RBAC pegawai/verifikator/atasan/admin, endpoint profil dan manajemen user, validasi TMT PPPK.

#### 12.2 Cuti, surat masuk, kuota, dan surat keterangan

Source: `tambah_surat_masuk.php`, `edit_surat_masuk.php`, `hapus_surat_masuk.php`, `tambah_acc.php`, `edit_acc.php`, `acc.php`, `acc_atasan1.php`, `acc_atasan2.php`, `transaksi_surat_masuk.php`, `belum_diperiksa.php`, `belum_kirim.php`, `cuti_jadi.php`, `ditolak.php`, `dibatalkan.php`, `buku_cuti.php`, `buku_cuti_awal.php`, `cetak_buku_cuti.php`, `cetak_sk.php`, `cetak_sk_pdf.php`, `suket_madrasah.php`, `tambah_suket.php`, `edit_suket.php`.
Tabel: `tbl_surat_masuk`, `tbl_acc`, `tbl_suket`, `tbl_suketmad`, `tbl_cuti_quota`, `tbl_cuti_settings`, `tbl_cuti_quota_log`.

Target: leave requests, quota engine, policy, approval, reserved balance, surat keterangan, output buku cuti, PDF, QR, upload/download, audit. Detail logic ada di `docs/cuti-quota-logic-report.html` dan section 3 plan ini.

#### 12.3 Surat tugas

Source: 20 file di `surattugas/`.
Fitur: daftar/pencarian, tambah/edit, penomoran surat (`surtug_input_nomor.php`), daftar pegawai (1:N), keterangan (1:N), tembusan (1:N), approval, upload lampiran, cetak surat tugas.

Target entity: `assignment_letters`, `assignment_members` (1:N, 14.195 baris legacy), `assignment_notes` (1:N, 3.864), `assignment_copies` (1:N, 3.235), approval current-state pada letter, `documents`/`document_links`.
Target API: CRUD letter, manage members/notes/copies, submit/approve/reject, numbering, print/download.

#### 12.4 Alibi

Source: 11 file di `alibi/`.
Fitur: daftar, tambah/edit, approval utama + atasan 1 + atasan 2, edit approval, upload dokumen, cetak alibi.

Target entity: `alibi_requests` (legacy `hlm_alibi` 5.953 baris) dengan approval current-state dilipat ke entity (mengikuti pola `hlm_alibi_acc` yang 1:1), `documents`/`document_links`, audit transisi status.
Target API: CRUD, submit, approve per level, reject, cancel, upload, print.

#### 12.5 Agenda

Source: 5 file di `agenda/`.
Fitur: daftar agenda, tambah/edit/hapus, input laporan agenda.

Target entity: `agendas` (legacy `hlm_agenda` 2.511 baris), `agenda_reports` bila laporan bukan 1:1.
Target API: CRUD agenda, input/update laporan, filter tanggal/user/unit/status.

#### 12.6 Disposisi dan surat masuk umum

Source: 34 file di `disposisi/`.
Fitur: surat masuk umum, klasifikasi, disposisi ke pelaksana, approval kakan/kasubbag, finalisasi, agenda surat masuk, referensi, galeri file surat masuk dan file SK, QR, cetak disposisi awal dan final.

Target entity: `incoming_letters` (legacy `hlm_edispo` 6.696), `dispositions` (1:N, `hlm_edispo_disposisi` 6.776), `disposition_assignees`, `letter_classifications` (`hlm_edispo_klasifikasi`), `incoming_letter_references`, status final (`hlm_edispo_final`), `documents`/`document_links`.
Target API: CRUD surat masuk, klasifikasi, create/update disposisi, assign pelaksana, approve/finalize, upload/referensi/galeri, cetak, QR verification.

#### 12.7 Pensiun

Source: 14 file di `pensiun/`.
Fitur: registrasi usulan pensiun, edit dan cek data, data super/pejabat, approval, surat keterangan, upload DPCP/SK/SP, cetak SPHD dan SPPID.

Target entity: `retirement_requests` (`hlm_pens_reg_usul` 302), data super bila 1:N, surat keterangan (`hlm_pens_reg_suket` 95), approval current-state (`hlm_pens_reg_acc` 292), documents.

#### 12.8 Izin belajar

Source: 29 file di `ijinbelajar/`.
Fitur: pengajuan dan edit, approval, dokumen detail (`ibel_dokumen.php` 1.450 baris), SPHD, 20 jenis upload, cetak SPHD.

Target entity: `study_permit_requests` (`hlm_ibel` 72), dokumen (`hlm_ibel` fields file + relasi), SPHD (`hlm_ibel_sphd`), approval current-state (`hlm_ibel_acc` 1:1), documents/document links.

#### 12.9 Tugas belajar

Source: 6 file di `tugasbelajar/`.
Fitur: pengajuan, edit, approval, dokumen, upload.

Target entity: `study_assignment_requests` (`tugas_belajar` 8 baris), approval current-state (`tugas_belajar_acc` 1:1), documents.

#### 12.10 Gelar

Source: 17 file di `gelar/`.
Fitur: pengajuan gelar, edit, approval, detail dokumen (`gelar_dokumen.php` 866 baris), 11 jenis upload.

Target entity: `degree_requests` (`hlm_gelar` 173), approval current-state (`hlm_gelar_acc` 1:1), documents/document links.

#### 12.11 Karpeg

Source: 11 file di `karpeg/`.
Fitur: pengajuan Karpeg, edit, approval, detail dokumen, upload CPNS/Karpeg/PNS/STTPL/sumpah.

Target entity: `employee_card_requests` subtype `karpeg` (`hlm_karpeg` 7), approval current-state (`hlm_karpeg_acc` 1:1), documents.

#### 12.12 Karis/Karsu

Source: 14 file di `kariskarsu/`.
Fitur: pengajuan Karis/Karsu, edit, approval, detail dokumen, upload data keluarga/nikah/KP/laporan/Karisu/PNS/CPNS.

Target entity: `family_card_requests` (`hlm_karisu` 210), approval current-state (`hlm_karisu_acc` 1:1), documents.

#### 12.13 BPJS

Source: 17 file di `bpjs/`.
Fitur: pengajuan BPJS, edit, approval, detail dokumen, upload akta/BPJS/CPNS/gaji/KK/KP/KP4/PPU/terakhir/undur diri/hilang.

Target entity: `health_insurance_requests` (`hlm_bpjs` 306), approval current-state (`hlm_bpjs_acc` 1:1), documents.

#### 12.14 Pangkat

Source: 45 file di `pangkat/`.
Fitur: pengajuan kenaikan pangkat dengan jalur JFT, JFU, STRK; cek approval per jalur; tambah/edit termasuk offline; 30+ jenis dokumen upload; file SK.

Target entity: `promotion_requests` (`hlm_pangkat` 11 + `hlm_pangkat_jft` 2, `hlm_pangkat_jfu`, `hlm_pangkat_sk`, `hlm_pangkat_strk`), track enum `jft`/`jfu`/`strk`, approval/check current-state, documents/document links, generated SK.
Catatan: satu modul ini saja 11.524 baris PHP; perlu fase tersendiri setelah CRUD dasar stabil.

#### 12.15 PMK

Source: 5 file di `pmk/`.
Fitur: pengajuan PMK, input/edit, approval, upload.

Target entity: `service_requests` subtype `pmk` (`tbl_pmk` + `tbl_pmk_acc`), dokumen, approval.

#### 12.16 Satya Lencana

Source: 20 file di `satyalencana/`.
Fitur: pengajuan Satya Lencana; input/edit jalur online dan offline; cek DRH; approval; SPPHD; detail dokumen; upload CPNS/DRH/jabatan/KP/piagam/SKP/SPHD/dokumen atasan; cetak SPHD.

Target entity: `service_requests` subtype `satya_lencana` (`hlm_satlen` 174), SPHD (`hlm_satlen_sphd` 72), approval current-state (`hlm_satlen_acc` 1:1), cek DRH, documents.

#### 12.17 SKMI/SKPP

Source: 5 file di `skmi_skpp/`.
Fitur: pengajuan SKMI/SKPP, input, approval, upload.

Target entity: `service_requests` subtype `skmi_skpp` (`tbl_skmi_skpp` + `tbl_skmi_skpp_acc`), dokumen, approval.

#### 12.18 Taspen

Source: 14 file di `taspen/`.
Fitur: pengajuan Taspen, edit, approval, detail dokumen, upload Karpeg/KGB/KP/KP4/PNS/SPMT/Taspen/CPNS.

Target entity: `pension_service_requests` subtype `taspen` (`hlm_taspen` 39), approval current-state (`hlm_taspen_acc` 1:1), documents.

#### 12.19 Backup, restore, dan operasional

Source: 14 file di `backup/`, termasuk dump modul lama dan skrip maintenance.

Target: backup database lewat tool operasional terkontrol, backup/versioning/retention object MinIO, restore drill terdokumentasi, endpoint restore tidak dibuka untuk user biasa.

#### 12.20 Library PDF dan QR

Source: `phpfpdf/` (FPDF 1.895 baris inti + font) dan `phpqrcode/` (9.637 baris).

Target: ganti ke library TypeScript yang sesuai, PDF dihasilkan langsung ke MinIO, QR menunjuk ke endpoint verifikasi, golden sample per modul + regression comparison.

#### 12.21 Tabel legacy yang harus dipetakan seluruhnya

Saat ini 59 tabel/view legacy teridentifikasi. Setiap tabel harus punya status salah satu: dipetakan, digabung, di-retire, atau di-defer, beserta alasannya. Tabel yang belum boleh hilang tanpa keputusan:

`hlm_alibi_acc`, `hlm_bpjs_acc`, `hlm_edispo_acc`, `hlm_edispo_final`, `hlm_edispo_klasifikasi`, `hlm_gelar_acc`, `hlm_ibel_acc`, `hlm_ibel_sphd`, `hlm_karisu_acc`, `hlm_karpeg_acc`, `hlm_pangkat_jft`, `hlm_pangkat_jfu`, `hlm_pangkat_sk`, `hlm_pangkat_strk`, `hlm_pens_reg_acc`, `hlm_pens_reg_suket`, `hlm_pens_reg_usul`, `hlm_satlen_acc`, `hlm_satlen_sphd`, `hlm_surtug_acc`, `hlm_surtug_ket`, `hlm_surtug_peg`, `hlm_surtug_tembus`, `hlm_taspen_acc`, `tbl_n2019`, `tbl_pmk_acc`, `tbl_skmi_skpp_acc`, `tbl_suket`, `tbl_suketmad`, `vw_cuti_quota_summary`.

`vw_cuti_quota_summary` adalah satu-satunya view; harus dibedah karena berisi logic agregasi kuota.

#### Gate Fase 12

Setiap modul baru dianggap selesai jika:

- seluruh menu legacy untuk modul tersebut sudah dipetakan;
- create, read, update, delete sesuai hak akses sudah ada;
- approval/status workflow sudah ada;
- seluruh jenis file dan batas validasinya sudah dipetakan;
- dokumen memakai `documents` + `document_links` + MinIO;
- output cetak/PDF yang ada sudah dipetakan;
- source table dan target table punya rekonsiliasi count;
- SQL hanya di query/command;
- unit, integration, permission, dan frontend test lulus;
- tidak ada fitur legacy yang hilang tanpa status `retire` atau `defer`.

### Fase 13 — PDF, QR, dan dokumen cetak

Deliverable:

- generator PDF TypeScript;
- QR verification endpoint;
- output PDF ke MinIO;
- template per modul;
- akses terproteksi.

Gate:

- sampel output dibandingkan dengan dokumen legacy;
- metadata dan object key tercatat;
- QR dapat diverifikasi;
- dokumen tidak bergantung pada filesystem lokal.

### Fase 14 — Regression, cutover, dan retirement

Regression matrix:

- PNS, PPPK, missing TMT;
- eligible dan belum eligible;
- request 0, 1, 6, 12, dan lebih dari 12 hari;
- request tahun berjalan, tahun lalu, dua tahun lalu;
- final, parsial, pending, ditolak, dibatalkan;
- edit dengan exclude current;
- concurrent submit;
- rollover, N-2 expiry, policy/SK, override, Cuti Besar;
- duplicate/orphan/negative/unit Tahun;
- file missing, retry, checksum mismatch;
- role dan permission seluruh modul.

Cutover:

1. Legacy menjadi read-only.
2. Jalankan final catch-up data dan file.
3. Rebuild seluruh projection.
4. Generate count dan saldo comparison report.
5. Review discrepancy.
6. Aktifkan TypeScript write path.
7. Pantau audit, error, dan missing object.
8. Pertahankan fallback legacy selama observasi.
9. Retire legacy setelah sign-off.

## 6. Command operasional target

```text
bun run typecheck
bun test
bun run mysql:verify
bun run storage:verify
bun run migrate:db --dry-run
bun run migrate:db --batch-size 500 --resume
bun run migrate:documents --dry-run
bun run migrate:documents --resume
bun run migrate:documents --retry-failed
bun run migrate:documents --verify
bun run migrate:documents --final-scan
bun run migrate:report
bun run web:build
```

## 7. Risiko dan mitigasi

| Risiko | Mitigasi |
|---|---|
| Logic quota berbeda antar fungsi legacy | Satu pure engine canonical + parity test |
| Approval legacy duplicate/orphan | Deduplicate, quarantine conflict, discrepancy report |
| Projection quota tidak lengkap | Rebuild dari `leave_requests`, bukan copy snapshot |
| Race condition pengajuan | Transaction + row/user-year lock atau reservation atomik |
| Retry migrasi membuat duplikat | Source identity, unique constraint, deterministic object key, HEAD/checksum |
| File hilang | Missing report, legacy fallback, tidak menghapus source sebelum verifikasi |
| Data baru selama migrasi | Incremental fingerprint scan + final catch-up scan |
| Password MD5 | Login kompatibel sementara lalu upgrade Argon2id/bcrypt |
| Periode tutup hard-code | Policy table/config dengan timezone eksplisit |
| PDF berbeda dari legacy | Golden sample dan regression comparison |

## 8. Definition of done

Refactor dianggap selesai bila:

- semua modul prioritas memiliki backend TypeScript dan frontend React;
- schema target dan mapping legacy terdokumentasi;
- engine quota memiliki parity test dan hasilnya disetujui;
- migration database dapat di-resume dan menghasilkan discrepancy report;
- seluruh dokumen yang direferensikan berhasil dipindah atau tercatat missing;
- MinIO menjadi storage utama;
- approval, quota, file, PDF, dan QR sudah diuji end-to-end;
- `typecheck`, unit test, integration test, storage verify, dan web build lulus;
- cutover dan rollback runbook tersedia;
- legacy masih dapat dibaca sampai sign-off final.

## 9. Sisa pekerjaan modul cuti (execution checklist)

Bagian ini ditulis supaya bisa dieksekusi tanpa membaca ulang percakapan. Semua klaim
diverifikasi lewat HTTP/DB pada 13 Okt 2026 kecuali yang ditandai **[belum diverifikasi]**.

### 9.0 Kondisi awal sebelum mulai (wajib)

```bash
# 1. MySQL + MinIO harus hidup
/Applications/XAMPP/xamppfiles/bin/mysql -h127.0.0.1 -uroot -e "SELECT 1" >/dev/null && echo "mysql ok"
curl -s -o /dev/null -w 'minio=%{http_code}\n' http://127.0.0.1:9000/minio/health/live
# kalau mati: /Users/hanafi/Pekerjaan/codebase-hono/.minio-data, jalankan ulang `minio server`

# 2. Migrasi harus 12/12 applied, 0 drift
cd /Users/hanafi/Pekerjaan/codebase-hono
MYSQL_DATABASE=sedakep bun run migrate:status

# 3. Node/bun
bun --version && bunx tsc --version
```

Terakhir terverifikasi: `mysql ok`, `minio=200`, `12 migrasi, 0 belum diterapkan, 0 drift`.

Akun demo (data uji, bukan hasil migrasi):

| username | role | catatan |
|---|---|---|
| `admin.sedakep` | admin | punya NIP + TMT |
| `atasan.sedakep` | atasan | punya NIP + TMT |
| `pegawai.sedakep` | pegawai | punya NIP + TMT |

Sandi disimpan di `DEMO_PASSWORD` dan **tidak ditulis di dokumen ini**. Untuk menimpanya
ulang: `MYSQL_DATABASE=sedakep DEMO_PASSWORD='<pilih-sandi>' bun run scripts/reset-demo-passwords.ts`.
Wajib menimpa sebelum menjalankan skrip uji karena sandi demonstrasi sebelumnya sudah
tidak berlaku (hash akun demo diperbarui saat uji alur cuti).

### 9.1 Apa yang sudah selesai (jangan dikerjakan ulang)

Backend cuti tuntas dan terbukti jalan lewat alur HTTP 18 langkah
(`/tmp/leave-flow.sh`, semua langkah 2xx):

```
ajukan multipart + lampiran -> admin terima -> atasan 1 -> atasan 2 -> final
-> terbitkan SK (nomor otomatis) -> unggah berkas SK -> adjustment kuota
-> buku cuti -> bersih-bersih data uji
```

Endpoint cuti yang sudah hidup (hasil `GET /openapi.json`):

| Method | Path | Guard |
|---|---|---|
| GET/POST | `/leave-requests` | bearer |
| GET/POST | `/leave-requests/statistics`, `/leave-requests/{id}` | bearer |
| PATCH/DELETE | `/leave-requests/{id}` | owner/admin |
| POST | `/leave-requests/{id}/approve/admin` | admin |
| POST | `/leave-requests/{id}/approve/level/{level}` | atasan/admin |
| POST | `/leave-requests/{id}/cancel` | owner/admin |
| GET/POST | `/leave-requests/{id}/letters` | bearer / admin+atasan |
| DELETE | `/leave-requests/{id}/letters/{letter_type}` | admin+atasan |
| GET | `/leave/letters` | admin+atasan |
| POST | `/leave/letters/{id}/file` | admin+atasan |
| GET | `/leave/types/{user_id}` | `me` atau angka |
| GET | `/leave/quota/available` | bearer (per-user dari token) |
| GET | `/leave/quota/{user_id}`, `/stored/{user_id}`, `/history/{user_id}` | `me` atau angka |
| POST | `/leave/quota/rebuild/{user_id}` | `me` atau admin |
| POST | `/leave/quota/rollover` | admin |
| GET/PUT | `/leave/policy` | bearer / admin |
| POST | `/leave/quota/adjustment` | admin |
| GET/DELETE | `/leave/quota/adjustment/{user_id}`, `/{id}` | `me` atau admin |
| POST | `/leave/quota/eligibility-override` | admin |
| GET | `/leave/admin/closure-periods` (+POST/PATCH/DELETE) | admin |
| GET/PUT | `/leave/admin/instance` | admin |
| GET/PUT | `/leave/admin/pppk-tmt` | admin |
| GET | `/leave/admin/quota-book`, `/admin/quota-audit`, `/admin/users` | admin |
| GET/POST | `/documents`, `/documents/{id}/download`, `/documents/unlinked` | bearer |

Migrasi DB (12 berkas, urut):

```
0001_master  0002_documents  0003_leave  0004_surat_tugas  0005_alibi_agenda
0006_disposisi  0007_service_requests  0008_migration_fixes  0009_approval_enum
0010_approver_cancel_enum  0011_leave_letters  0012_letter_counters
```

Catatan penting `0012_letter_counters.sql`: kolom `id` pada `leave_letter_counters`
sengaja **tanpa AUTO_INCREMENT**. Dengan AUTO_INCREMENT, MySQL menimpa nilai
`LAST_INSERT_ID(expr)` sehingga penomoran atomik tidak mungkin. Jangan mengembalikan
AUTO_INCREMENT kecuali `nextLeaveLetterNumber` ditulis ulang.

Tabel cuti dan isinya saat ini:

| tabel | baris |
|---|---:|
| `leave_requests` | 7.926 |
| `leave_quotas` | 3.954 |
| `leave_quota_audits` | 15.843 |
| `leave_policies` | 7 |
| `leave_closure_periods` | 1 |
| `leave_letters` | **0** |
| `leave_letter_counters` | **0** |
| `leave_quota_adjustments` | 0 |
| `settings` | **0** |

`leave_eligibility_overrides` **tidak ada sebagai tabel** — override disimpan sebagai baris
`settings` dengan kunci `leave_override:{user_id}:{year}`
(`setEligibilityOverride` / `findEligibilityOverride` di command/query). Jangan membuat
tabel baru untuk ini.

Tes: `bun test` 88 lulus sebelum pekerjaan frontend; setelah itu ditambah
`tests/leave-endpoints.test.ts` dan `tests/architecture-leave.test.ts` (jumlah akhir
**[belum diverifikasi]** karena perubahan frontend belum dijalankan ulang).

### 9.2 Tujuh bug yang ditemukan lewat probe HTTP (jangan diulang)

Semua ini lolos `tsc` dan hanya muncul saat endpoint benar-benar dipanggil:

1. **`/leave/quota/available` tertelan `/leave/quota/{user_id}`** → 422. Perbaikan:
   daftarkan route literal sebelum route ber-parameter di `leave.routes.ts`.
2. **Segmen parsial `level-{level}`** → terdaftar di OpenAPI tetapi selalu 404. Pakai
   `/approve/level/{level}`.
3. **Multipart mengirim angka sebagai string** → zod 422 sebelum handler jalan. Semua
   field numerik pada route multipart harus `z.coerce.number()`.
4. **Kolom `documents.bucket` NOT NULL tidak diisi** oleh `documents/service` → semua
   unggahan gagal, termasuk lampiran cuti. Kalau ada unggahan gagal 500, cek ini dulu.
5. **`listLetters` mengabaikan filter camelCase** dari route (`letterType` vs
   `letter_type`) → daftar surat selalu penuh.
6. **Pencarian buku cuti tidak mendukung id**; filter status arsip tidak jalan karena
   beberapa arsip memetakan ke >1 status sementara API hanya menerima satu.
7. **MIME uji tidak diizinkan** → ekspektasi tes yang salah, bukan bug kode. Daftar MIME
   yang diterima: `application/pdf`, `image/jpeg`, `image/png`, `image/webp`,
   `image/heic`; maksimum 10 MB.

### 9.3 Sisa pekerjaan A — wire frontend (BLOCKER, kerjakan lebih dulu)

Empat halaman sudah ditulis ulang dan **typecheck:web lulus**, tetapi belum terhubung ke
router/menu dan sebagian kelas CSS belum ada. Tanpa langkah ini `web:build` bisa lulus
tetapi UI-nya mati (halaman tidak bisa dibuka).

Berkas yang sudah ditulis (jangan tulis ulang, cukup wire):

- `web/src/pages/LeaveForm.tsx` — jenis cuti dari `GET /leave/types/me`, simulasi kuota dari
  API, unggah lampiran multipart lewat `api.createLeaveRequestWithAttachment`.
- `web/src/pages/LeaveDetail.tsx` — timeline approval, daftar lampiran, panel surat
  keterangan (terbitkan SK / SK madrasah, unggah berkas SK, cabut).
- `web/src/pages/LeaveList.tsx` — tab arsip (semua / belum diperiksa / jadi / ditolak /
  dibatalkan), filter jenis + tahun, rekap per jenis dari `/leave-requests/statistics`.
- `web/src/pages/Faq.tsx` — isi FAQ Cuti PNS disalin apa adanya dari `faq_cuti.php` legacy
  (Peraturan BKN No. 7 Tahun 2021), tautan ke Buku Saku BKN.

**A1. Update `web/src/api.ts`** — sudah memuat helper untuk hampir semua endpoint
(`getLeaveTypeOptions`, `getLeaveStatistics`, `listLetters`, `issueLetter`,
`uploadLetterFile`, `revokeLetter`, `getQuotaBook`, `listAdminUsers`,
`getQuotaAuditTrail`, `getPppkTmt`, `setPppkTmt`, `getLeavePolicy`, `applyLeavePolicy`,
`rolloverQuota`, `createQuotaAdjustment`, `listQuotaAdjustments`,
`deleteQuotaAdjustment`, `setEligibilityOverride`, `getInstanceProfile`,
`updateInstanceProfile`, `listClosurePeriods`, `createClosurePeriod`,
`updateClosurePeriod`, `deleteClosurePeriod`). Fungsi yang **belum ada** dan dibutuhkan
halaman baru:

```ts
// kuota satu pegawai (halaman admin) — sudah ada getQuota(year) untuk 'me';
// tambahkan varian per-user supaya admin bisa melihat pegawai lain:
export const getQuotaFor = (userId: number | 'me', year?: number) =>
  request<Quota>(`/api/v1/leave/quota/${userId}${buildQuery({ year })}`);

export const rebuildQuotaFor = (userId: number | 'me', year: number) =>
  request<Record<string, unknown>>(`/api/v1/leave/quota/rebuild/${userId}`, {
    method: 'POST',
    body: JSON.stringify({ year, user_id: userId === 'me' ? undefined : userId }),
  });
```

**A2. Update `web/src/main.tsx`** — tambahkan route (nama path persis):

```tsx
<Route path="leave/letters" element={<RequireAuth roles={['atasan']} />}>
  <Route index element={<Letters />} />
</Route>
<Route path="faq" element={<Faq />} />
<Route path="admin/leave" element={<RequireAuth roles={['atasan']} />}>
  <Route index element={<LeaveAdmin />} />
</Route>
```

`roles={['atasan']}` di sini berarti admin juga lolos (lihat cara `RequireAuth` di
`web/src/components/RequireAuth.tsx`; admin selalu diizinkan). Konsistenkan dengan guard
backend — jangan pakai role yang tidak ada di ENUM `users.role`
(`pegawai|verifikator|atasan|admin`).

**A3. Update `web/src/components/Layout.tsx`** — tambahkan ke `menus`:

```ts
{ to: '/leave/letters', label: 'Surat Keterangan', roles: ['verifikator', 'atasan'] },
{ to: '/admin/leave', label: 'Admin Cuti', roles: ['verifikator', 'atasan'] },
{ to: '/faq', label: 'FAQ Cuti' },
```

Perhatikan: `menus` di Layout hanya boleh memakai role yang sama dengan guard route —
menu yang disembunyikan CSS tetap bisa dibuka lewat URL.

**A4. Tambahkan kelas CSS yang HILANG di `web/src/styles.css`.** Hasil cek langsung:
`MISSING: .warn-note, .tabs, .tab, .faq`. Semua kelas lain yang dipakai halaman baru
(`.ok`, `.err`, `.notice`, `.kv`, `.timeline`, `.docs`, `.actions`, `.grid2`, `.split`,
`.pager`, `.badge`) sudah ada. Tanpa empat kelas ini tab arsip tampil seperti tombol
biasa dan indikator simulasi kuota tidak terbaca. Sisipkan di akhir berkas, mengikuti
variabel warna yang sudah ada (`--line`, `--accent`, `--warn`):

```css
/* ---------------------------------------------------------------- tabs & faq */

.tabs { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 16px; }
.tab { background: var(--panel); border: 1px solid var(--line); color: var(--muted); font-weight: 500; }
.tab.active { background: var(--accent); border-color: var(--accent); color: #fff; }
.warn-note { margin-top: 12px; font-size: 12.5px; color: var(--warn); }

.faq { margin: 0; padding-left: 20px; }
.faq > li { margin-bottom: 18px; }
.faq h3 { margin: 0 0 6px; font-size: 14px; }
.faq ul { margin: 0; padding-left: 18px; }
.faq li { margin-bottom: 4px; }
```

**A5. Halaman baru yang masih harus ditulis** (halaman di atas hanya menutup kebutuhannya
dari `docs/fitur-legacy-vs-target.md`):

| berkas baru | isi | API yang dipakai |
|---|---|---|
| `web/src/pages/LeaveAdmin.tsx` | tab: **Buku cuti** (per tahun, cari nama/NIP/id), **Penyesuaian kuota** (tambah/hapus, pilih pegawai), **Pengaturan** (default hari, batas N-1/N-2, min masa kerja, tulis policy dengan `confirm`), **TMT PPPK** (daftar recorded/missing, PUT tmt), **Periode tutup** (CRUD), **Identitas instansi** (GET/PUT), **Audit kuota** | `getQuotaBook`, `listQuotaAdjustments`, `createQuotaAdjustment`, `deleteQuotaAdjustment`, `getLeavePolicy`, `applyLeavePolicy`, `getPppkTmt`, `setPppkTmt`, `listClosurePeriods`, `createClosurePeriod`, `updateClosurePeriod`, `deleteClosurePeriod`, `getInstanceProfile`, `updateInstanceProfile`, `getQuotaAuditTrail`, `rolloverQuota`, `setEligibilityOverride` |
| `web/src/pages/Letters.tsx` | daftar surat keterangan + SK madrasah, filter jenis & pencarian, tombol unduh berkas, tombol cabut | `listLetters`, `getDownloadUrl`, `revokeLetter` |
| `web/src/pages/QuotaBook.tsx` (atau panel di LeaveAdmin, lebih hemat) | tabel projection per pegawai untuk satu tahun | `getQuotaBook` |

Sengaja **tidak** dibuat: atas nama "hak akses 5 tingkat legacy". Target hanya punya 4 role;
3 role legacy (Admin Unit Kerja, Admin eDispo/TTE, Admin Presensi) tidak punya padanan dan
**bukan** fitur yang hilang — itu keputusan arsitektur yang sudah disetujui. Catat di
laporan, jangan diimplementasikan diam-diam.

### 9.4 Sisa pekerjaan B — migrasi data surat keterangan

`tbl_suket` (3.367 baris) dan `tbl_suketmad` (596) **sudah tercatat** di
`api/migrate/document-sources.ts` dan sudah pernah dipindai:

```
document  tbl_suket      skipped_missing  3307
document  tbl_suketmad   skipped_missing   596
```

Artinya: metadata tercatat, tapi **berkas fisiknya tidak ada di mesin ini**.
`upload/surat_keterangan/` hanya berisi `.DS_Store` (0 berkas), dan `upload_sk.php`
menyimpan nama file apa adanya di kolom `file_sk`. Jadi 3.903 PDF SK cuti hilang
bersama 17.692 berkas lain (5,5% yang ada di mesin ini). Tindak lanjutnya satu paket
dengan keputusan "ambil dari server produksi" — lihat 9.6.

Yang **bisa** dikerjakan tanpa berkas fisik: migrasi barisnya ke `leave_letters`.

Kolom sumber:

```
tbl_suket    : id_suket, nomor(int), tgl_cetak(date), pejabat, nama_pejabat, file_sk,
               id_surat, id_user
tbl_suketmad : id_suketmad, file_sk, id_surat, id_user
```

Kolom target `leave_letters`: `id, leave_request_id, letter_type, number, issued_at,
official_position, official_name, document_id, legacy_id, created_by, created_at,
updated_at`.

Tanggal penting yang harus diselesaikan **sebelum** menulis skrip:

1. **`tbl_suket.nomor` bukan nomor surat unik.** `COUNT(*)`=3.367, `COUNT(DISTINCT nomor)`
   hanya **1.043**, dan per tahun juga kurang (2023: 781 baris / 519 distinct; 2024: 686/141).
   Kemungkinan besar `nomor` = ID baris, bukan nomor surat. **Jangan** memetakan `nomor`
   ke `leave_letters.number` sebelum diperiksa. Periksa dulu:
   `SELECT nomor, COUNT(*) c FROM ptsp_sedakep.tbl_suket GROUP BY nomor HAVING c > 1 LIMIT 20;`
   Kalau memang bukan nomor surat, isi `number = NULL` dan simpan `nomor` di `legacy_id`.
2. **`tbl_suket.id_surat` = 0 pada SEMUA 3.367 baris** (`SUM(id_surat IS NULL OR id_surat=0)`
   = 3.367). Sumber tidak punya tautan langsung ke permohonan. `tbl_suketmad.id_surat`
   justru terisi (596/596 terisi), dan nilainya menunjuk ke `id_surat` di tabel cuti.
   Jadi:
   - `tbl_suketmad` → `leave_requests.id` bisa dipetakan lewat `id_surat`.
   - `tbl_suket` → **tidak bisa**. Perlu tebakan dari nama file
     (`^(\d+)-(.+) (\d{8})-(\d{8})\.pdf$` → NIP-awalan + rentang tanggal) dan pencocokan
     ke permohonan, atau dibiarkan `leave_request_id` menunjuk baris "tidak diketahui".
     `leave_request_id` NOT NULL, jadi opsi minimal: buat baris `leave_requests` bayangan
     atau longgarkan kolomnya lewat migrasi `0013`. **Putuskan dulu, jangan improvisasi.**
3. **`pejabat` vs `nama_pejabat`**: `official_position` = `pejabat`,
   `official_name` = `nama_pejabat`.
4. **`tgl_cetak` NULL** harus ditangani karena `issued_at` DATE nullable — boleh NULL.
5. `legacy_id` = `suket:{id_suket}` / `suketmad:{id_suketmad}` supaya idempoten.
6. `created_by` = hasil pemetaan `id_user` legacy (`legacy_mappings`) atau NULL.
7. `document_id` diisi hanya kalau berkasnya berhasil diunggah ke MinIO.

Bentuk skrip yang diharapkan (mengikuti pola `api/migrate/leave.ts`, resumable):

```
api/migrate/leave-letters.ts     # logika murni, tanpa CLI
scripts/migrate-letters.ts       # CLI: --dry-run | --resume | --verify
```

Wajib: `--dry-run` menjalankan query yang sama dan mencetak hitungan yang sama. Counter
yang harus dicetak: `read`, `written`, `skipped_already_there`, `unmapped_request`,
`no_number`, `document_linked`, `failed`.

Verifikasi setelah selesai:

```sql
SELECT letter_type, COUNT(*) FROM sedakep.leave_letters GROUP BY letter_type;
-- harapan: suket <= 3367, suket_madrasah <= 596
SELECT COUNT(*) FROM sedakep.leave_letters WHERE legacy_id IS NULL;  -- harapan: 0
```

### 9.5 Sisa pekerjaan C — tes dan gate

**C1. Tes yang belum ada** (tulis dulu, baru perbaiki sampai hijau):

| berkas | yang dijamin |
|---|---|
| `tests/leave-letters.test.ts` | terbit surat gagal kalau permohonan belum final (400); nomor otomatis naik berurutan; **dua penerbitan bersamaan tidak mendapat nomor sama** (jalankan 8 request paralel, kumpulkan nomor, pastikan `distinct == 8`) |
| `tests/leave-attachment.test.ts` | jenis cuti wajib lampiran: tanpa berkas → 400 **dan tidak ada baris `leave_requests` baru**; dengan berkas → baris + `attachment_id` terisi |
| `tests/leave-closure.test.ts` | pengajuan di dalam periode tutup yang `enabled=1` ditolak; `enabled=0` lolos |
| `tests/leave-admin.test.ts` | `pegawai` kena 403 di seluruh `/leave/admin/*`; admin lolos |

Pola yang sudah terbukti dipakai `writeFileSync` untuk membuat berkas uji lalu dikirim
lewat `FormData` ke `app.request` — lihat `tests/leave-endpoints.test.ts` sebagai
kerangka (helper login, `authHeaders`, penyimpanan id untuk pembersihan).

**C2. Aturan wajib saat menulis tes:** jangan pernah menyentuh DB aplikasi. `bun test`
memuat `.env` **sebelum** `test-setup.ts`, sehingga `??=` tidak menimpa `MYSQL_DATABASE`
dan suite berjalan ke `sedakep` — pernah menghapus data. Setiap tes yang menghapus/menulis
wajib memanggil `assertTestDatabase()` di `beforeEach` (lihat `tests/helpers/db.ts`).
**Jangan** mengubah override di `api/test-setup.ts` kembali ke `??=`.

**C3. Gate lengkap yang harus lulus sebelum menandai cuti selesai:**

```bash
cd /Users/hanafi/Pekerjaan/codebase-hono
bunx tsc --noEmit -p tsconfig.json      # API — terakhir lulus
bun run typecheck:web                    # web — terakhir lulus SEBELUM Faq.tsx & CSS baru
bun test                                 # jangan lupa: DB uji, bukan sedakep
bun run web:build
```

**C4. Uji lewat proxy Vite, bukan hanya port API.** Typecheck + build hijau pernah
menyembunyikan tiga endpoint mati. Jalankan kedua server:

```bash
# API
MYSQL_DATABASE=sedakep bun run api > /tmp/api.log 2>&1 &
# web (proxy ke API_TARGET)
cd web && bun run dev > /tmp/web.log 2>&1 &
```

Lalu ulangi `/tmp/leave-flow.sh` dengan `API_BASE=http://localhost:5173` dan tambahkan
langkah: buka `/leave/letters`, `/admin/leave`, `/faq` lewat proxy minimal sebagai
`GET /api/v1/leave/letters`, `GET /api/v1/leave/admin/quota-book`,
`GET /api/v1/leave/policy`. Yang dibuktikan langkah ini: nama route, bentuk
request/response, dan proxy sepakat.

**C5. Verifikasi visual browser masih terblokir.** Chrome menolak remote debugging dengan
popup izin yang harus diklik pengguna. Sampai itu diklik, jangan mengklaim UI "sudah
dilihat". Bukti yang jujur: typecheck + build + HTTP lewat proxy.

### 9.6 Sisa pekerjaan D — keputusan yang menunggu pengguna

Dua hal ini memblokir pekerjaan lain, jadi harus dijawab lebih dulu:

1. **17.692 + 3.903 berkas hilang.** File legacy yang direferensikan total 18.722 rujukan;
   yang ada di mesin ini hanya 1.030 (5,5%). `tbl_suket`/`tbl_suketmad` menyumbang 3.903
   dari yang hilang. Opsi: (a) ambil dari server produksi, (b) tandai hilang permanen dan
   lanjut, (c) tunda. Tanpa keputusan ini Fase 10 dan 9.4 tidak bisa dinyatakan tuntas.
2. **Selisih 173 baris**: `leave_requests` 7.926 vs `tbl_surat_masuk` 7.753 pada snapshot
   audit. Gate Fase 14 menuntut penjelasan tertulis. Kandidat penyebab: baris dihapus di
   target (duplikat id 20,21 sudah pernah dibersihkan) atau baris legacy masuk setelah
   snapshot audit diambil. Buktikan dengan perbandingan `MIN(id)`/`MAX(id)`/PK-range,
   **jangan** `information_schema.TABLE_ROWS` (itu estimasi InnoDB, pernah melaporkan
   7.751 untuk tabel berisi 7.926).

### 9.7 Urutan eksekusi yang disarankan

1. 9.3 A4 (CSS) → A2/A3 (route + menu) → A1 (dua helper api.ts).
2. Tulis `LeaveAdmin.tsx` + `Letters.tsx`.
3. Jalankan gate C3; perbaiki sampai hijau.
4. Tambahkan tes C1; jalankan lagi.
5. Jalankan C4 lewat proxy.
6. Minta keputusan 9.6, baru kerjakan 9.4 (migrasi baris surat).
7. Perbarui bagian ini dengan hasil nyata, lalu lanjut Fase 12.

### 9.8 Jebakan yang sudah memakan waktu (ringkas)

- `pkill -f "api/index.ts"` **tidak cocok** dengan proses `bun run api`. Cari PID lewat
  `lsof -nP -iTCP:3000 -sTCP:LISTEN -t` lalu `kill -9`.
- Menyalakan API lewat terminal langsung (`... &`) ditolak tool. Pakai
  `terminal(background=True)` atau jalankan dalam skrip bash.
- Utilitas `head` di shell ini bukan GNU head (tampil "Usage: head [-options]"). Gunakan
  `sed -n '1,20p'` atau `read_file`.
- Kolom DATE: pool memakai `dateStrings: true`; jangan melepasnya atau `toDateOnly()` —
  tanpa itu semua perhitungan per tahun menjadi `NaN` dan permohonan pending menghilang
  dari bucket `reserved` tanpa error.
- Nama kolom yang tampak ter-mask (`***`, `sk_...`) di output tool adalah artefak masking
  output, **bukan** isi berkas. Jangan menulis ulang berkas karena tampilannya.
- Arch guard `tests/architecture-leave.test.ts` case-sensitive: tulis kata kunci SQL
  dalam HURUF BESAR dan pakai `update`/`hapus` sebagai kata biasa di komentar.
- Route cuti di `leave.routes.ts` harus mendaftarkan path literal (`/leave/quota/available`)
  **sebelum** path ber-parameter (`/leave/quota/{user_id}`).

### 9.9 Hasil eksekusi (13 Okt 2026)

**9.3 A1–A5 — SELESAI.**
- A4 CSS: `.tabs`, `.tab`, `.warn-note`, `.faq` ditambahkan di `web/src/styles.css`.
- A1: `getQuotaFor` + `rebuildQuotaFor` di `web/src/api.ts`; tipe admin (`AdminUserRow`,
  `QuotaAuditRow`, `PppkTmt*`) disamakan dengan respons nyata; `updateClosurePeriod` memakai
  `enabled: boolean`.
- A2/A3: route `/leave/letters`, `/admin/leave`, `/faq` di `web/src/main.tsx` + menu di
  `Layout.tsx`. Guard dibuat **konsisten dengan backend**, bukan seperti draft: `leave/letters`
  → verifikator/atasan; `admin/leave` → **admin saja** (backend `requireRole('admin')`).
- A5: `web/src/pages/{Letters,LeaveAdmin}.tsx` ditulis (LeaveAdmin: buku cuti, penyesuaian,
  pengaturan, TMT PPPK, periode tutup, identitas instansi, audit).

**9.5 C1 — SELESAI.** `tests/{leave-letters,leave-attachment,leave-closure,leave-admin}.test.ts`.
Catatan: penolakan validasi bisnis memakai `badRequest` → **HTTP 422**, bukan 400 seperti draft.

**Gate C3.** `tsc` API lulus, `typecheck:web` lulus, `bun test` **118 lulus / 0 gagal**,
`web:build` lulus. **C4** untuk cuti lulus (15 pemeriksaan lewat proxy Vite). Smoke proxy untuk
surat tugas **dilewati atas permintaan**.

**9.6.2 — terjawab: selisih 173 baris = nol.** `COUNT(*)` `leave_requests` = 7.926 =
`tbl_surat_masuk`; 0 baris sumber hilang di target, 0 baris target tanpa sumber (join
`legacy_id` = `id_surat`). Angka 7.753 pada audit adalah estimasi InnoDB `TABLE_ROWS` yang
memang tidak akurat. Catatan penting: `leave_requests.legacy_id` berisi `id_surat` polos
(mis. `1`), **bukan** `legacy:tbl_surat_masuk:1` seperti tertulis di §9.

**9.6.1 + 9.4 — DITUNDA (keputusan pemilik).** Migrasi berkas & baris surat ditunda; fokus
dialihkan ke port fitur.

**Fase 12.3 — Surat tugas: fondasi dikerjakan.** Modul baru `api/modules/assignments/`
(schema, query, command, service, routes) + halaman `web/src/pages/{Assignments,AssignmentForm,
AssignmentDetail}.tsx`, terdaftar di `api/app.ts`, `web/src/main.tsx`, dan menu `Layout.tsx`.
Fitur: CRUD header, anggota/keterangan/tembusan 1:N, approval admin current-state, penomoran
manual setelah disetujui (`B-{no}/Kk.12.04/{kode}/{MM}/{YYYY}`), unggah berkas via
documents/MinIO. SQL hanya di query/command. Tes `tests/assignment-api.test.ts` (8 lulus) +
guard arsitektur. **Cetak/PDF masih `defer` ke Fase 13.** Migrasi isi 0 baris
(`hlm_surtug` 3.194) belum dijalankan.

**Surat tugas — dilengkapi.** Ditambah `POST /assignment-letters/{id}/cancel` dan data
instansi (`instance`) pada detail; halaman cetak `web/src/pages/AssignmentPrint.tsx` +
CSS `.print-sheet`/`@media print`. Tombol Cetak/Batalkan di detail.

**Cuti — cetak ditambahkan.** `GET /leave/quota/book/{user_id}` (data buku cuti + kop) dan
`instance` pada detail permohonan; halaman `LeavePrint.tsx` (SK cuti) dan `QuotaPrint.tsx`
(buku cuti); tombol Cetak di `LeaveDetail` dan `Quota`.

**Fase 12.4 — Alibi: selesai (fitur).** Modul `api/modules/alibi/` — approval tiga tingkat
(admin → atasan 1 → atasan 2), cancel, dan unggah berkas; halaman
`Alibi.tsx`/`AlibiForm.tsx`/`AlibiDetail.tsx`/`AlibiPrint.tsx`. Tes `tests/alibi-api.test.ts`
(9 lulus) + guard arsitektur. Migrasi isi `hlm_alibi` (6.057) tetap `defer`.

**Gate akhir:** `tsc` API lulus, `typecheck:web` lulus, `bun test` **128 lulus / 0 gagal**,
`web:build` lulus (649 kB / 172 kB gzip).

**Catatan cetak:** memakai tampilan HTML siap-print (`window.print()`), bukan PDF sisi
server → MinIO. Generator PDF + QR tetap **Fase 13**.

**Fase 12.6 — Disposisi: selesai (fitur).** Modul `api/modules/dispositions/` — surat masuk
(`incoming_letters`), klasifikasi (`letter_classifications`), disposisi pelaksana 1:N
(`dispositions`), baris final (`disposition_finals`), referensi, finalisasi, dan unggah berkas
(surat masuk/SK). Halaman `IncomingLetters` / `IncomingLetterForm` / `IncomingLetterDetail` /
`LetterClassifications` / `DispositionPrint`. Seluruh endpoint staf saja (pegawai 403). Tes
`tests/dispositions-api.test.ts` (8 lulus) + guard arsitektur. Catatan: approval kakan/kasubbag
legacy (`hlm_edispo_acc`) dilipat ke aksi `finalize` + audit (schema target tak punya kolomnya).

**Fase 12.5 — Agenda: selesai (fitur).** Modul `api/modules/agendas/` — CRUD agenda
(`agendas`), input laporan + `reported_at`, unggah berkas laporan. Halaman `Agendas` /
`AgendaForm` / `AgendaDetail`. Pemilik/admin mengelola, staf melihat semua. Tes
`tests/agenda-api.test.ts` (7 lulus) + guard arsitektur.

**Fase 12.7–12.18 — Layanan kepegawaian (generik): selesai (fitur).** Satu modul
`api/modules/service-requests/` menutup **pensiun, gelar, karpeg, karis/karsu, BPJS, taspen,
satya lencana, izin belajar, tugas belajar, PMK, SKMI/SKPP, dan pangkat** — dibedakan
`service_type`. Memakai tabel generik `service_requests` + `service_request_fields`
(nilai spesifik per jenis), `service_documents` (dokumen berlabel), `service_request_checks`
(verifikasi berkas), dan `generated_letters` (SPHD/SPPID/SK/Suket). Konfigurasi
field/dokumen/surat per jenis ada di `domain/service-types.ts`. Halaman `ServiceRequests` /
`ServiceRequestForm` (form dinamis dari metadata) / `ServiceRequestDetail` (dokumen berlabel,
verifikasi, surat, approval). Tes `tests/service-requests-api.test.ts` (9 lulus) + guard
arsitektur.

**Gate akhir:** `tsc` API lulus, `typecheck:web` lulus, `bun test` **149 lulus / 0 gagal**,
`web:build` lulus (727 kB / 183 kB gzip).

**Fase 13 — PDF + QR: selesai.** `api/shared/pdf.ts` (builder PDF via `pdf-lib`) +
`api/shared/verify.ts` (kode verifikasi HMAC) + endpoint publik `GET /verify/{code}`
(`api/modules/verify/`). PDF dihasilkan untuk **surat tugas**, **SK cuti**, dan **surat
layanan kepegawaian (SPHD/SK/Suket)**; diunggah ke MinIO lewat documents dan memuat **QR**
yang menunjuk tautan verifikasi. Tombol "Cetak PDF" ditambahkan di halaman detail terkait.
Dependensi baru: `pdf-lib`, `qrcode`; konfigurasi baru: `PUBLIC_BASE_URL`. Tes
`tests/pdf-verify.test.ts` (5 lulus). Verifikasi publik sengaja memakai kode bertanda tangan
HMAC (tidak bisa dienumerasi) dan hanya mengembalikan ringkasan non-sensitif.

**Gate akhir:** `tsc` API lulus, `typecheck:web` lulus, `bun test` **153 lulus / 0 gagal**,
`web:build` lulus (728 kB / 183 kB gzip).

**Fase 12.19 — backup operasional: selesai.** `scripts/backup.ts` (`bun run backup`) membuat
dump DB terkontrol (`--single-transaction`), mencatat baris `documents`; objek MinIO
dilewatkan ke `mc mirror` + versioning (tidak ada endpoint restore untuk user biasa).

**Fase 14 — cutover & regresi: artifact selesai, eksekusi menunggu go-live.**
- `scripts/go-live-report.ts` (`bun run report:go-live`) — bandingkan jumlah baris sumber
  legacy vs target, tulis `docs/go-live-report.csv` + `docs/go-live-report.html`.
- `docs/cutover-runbook.md` — urutan cutover 9 langkah, rollback, backup/restore, verifikasi.
- `docs/regression-matrix.md` — pemetaan matriks regresi ke berkas tes.
- Hasil laporan saat ini: **cuti cocok** (7.926 = 7.926); modul lain 0 di target karena
  **migrasi isi ditunda**; `users` target +4 (akun demo) — tercatat sebagai selisih diketahui.

**Gate akhir:** `tsc` API lulus, `typecheck:web` lulus, `bun test` **153 lulus / 0 gagal**,
`web:build` lulus (728 kB / 183 kB gzip).

**Fitur tambahan — administrasi pengguna & verifikasi QR.** Halaman `Users.tsx` (admin:
daftar, tambah, ubah peran/status, reset sandi) dan `Profile.tsx` (ubah data diri + ganti
sandi) di frontend; route `admin/users` (admin) + `profile`. Halaman publik `Verify.tsx` di
`/verify/:code` (dibuka dari QR PDF) memanggil `/api/v1/verify/{code}`; endpoint verifikasi
kini juga di-mount di `/api/v1`. Tes `tests/user-admin.test.ts` (4 lulus).

**Gate:** `bun test` **157 lulus / 0 gagal**, `web:build` 63 modul.

**Fitur tambahan 2 — master data & QR cetak HTML.** Modul `api/modules/master/` (organisasi/
unit kerja + jabatan; baca untuk user login, tulis hanya admin) dan halaman `MasterData.tsx`
di `/admin/master`. QR kini tampil juga di **tampilan cetak HTML** (surat tugas, SK cuti,
alibi, disposisi) lewat endpoint publik `GET /verify/{code}/qr`; verifikasi publik mendukung
`alibi_requests` dan `incoming_letters`; detail terkait mengirim `verify_code`. Tes
`tests/master.test.ts` (3 lulus) + `tests/pdf-verify.test.ts` (QR PNG).

**Gate:** `bun test` **161 lulus / 0 gagal**.

**Fitur tambahan 3 — pengaturan umum & scheduler rollover.** Modul
`api/modules/settings/` (CRUD key/value `settings`, admin saja, audit + penyamaran nilai
rahasia + kunci `scheduler.*` read-only) dan halaman `web/src/pages/Settings.tsx`
(`/admin/settings`): Identitas instansi dipindahkan dari Admin Cuti ke sini.
`api/scheduler/` + `scripts/scheduler.ts` (`bun run scheduler`, flag `--once/--dry-run/--force`)
menjalankan `rolloverYear()` otomatis pada tanggal yang dikonfigurasi (default 1 Januari
`Asia/Jakarta`), idempoten lewat penanda `settings` `scheduler.rollover.{tahun}` dan
tercatat di `audit_logs`. Config baru: `SCHEDULER_TZ`, `SCHEDULER_ROLLOVER_MONTH`,
`SCHEDULER_ROLLOVER_DAY`, `SCHEDULER_INTERVAL_MINUTES`. Tes:
`tests/settings-api.test.ts`, `tests/scheduler.test.ts`, `tests/architecture-settings.test.ts`.
Runbook scheduler ada di `docs/cutover-runbook.md`.

**Masih belum dicover (diketahui):** smoke proxy penuh via browser; migrasi isi
data/berkas dan eksekusi cutover (menunggu keputusan pemilik).
