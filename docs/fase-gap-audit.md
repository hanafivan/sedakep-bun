# Audit Gap — Fase yang Belum Berjalan

Tanggal: 9 Oktober 2026. Metode: baca plan per fase, cek kode, lalu uji endpoint lewat HTTP
(proxy web `localhost:5173`) dan hitung baris DB dari sisi legacy dan target.

## Ringkasan

| Rentang | Status |
|---|---|
| Fase 1–4 | Selesai |
| Fase 5–7 | Selesai, 3 sub-item kurang |
| Fase 8 | Selesai sebagian — rollover, policy tulis, override belum ada |
| Fase 9 | Selesai, laporan discrepancy belum jadi artifact |
| Fase 10–11 | Selesai penuh |
| Fase 12 | Schema 32/32 tabel siap, **isi 0 baris** |
| Fase 13 | Belum mulai |
| Fase 14 | Belum mulai |

## A. Gap di Fase 5–9 (kode sudah ada, sebagian belum lengkap)

### A1. Race condition kuota — TERBUKTI

Belum ada lock/transaction saat create. Uji: 8 permohonan 3 hari ditembak bersamaan oleh
`pegawai.sedakep` (saldo 24, ada 1 reserved 2 hari sebelumnya).

Hasil uji: **8/8 diterima** → `reserved_days 2 → 26` padahal jatah 24. Saldo minus.

Plan Fase 6 langkah 4 minta "lock scope user/tahun" — belum diimplementasikan.
Ini satu-satunya gap yang bikin data rusak, bukan sekadar fitur kurang.

### A2. `GET /leave/quota/available` → 422

Plan Fase 5 mencantumkan endpoint ini. Yang ada hanya `/leave/quota/{user_id}` yang sudah
mengembalikan blok `available`, jadi secara fungsi terpenuhi, tapi path yang dijanjikan plan
tidak ada.

### A3. Upload lampiran dari user — belum ada

Plan Fase 6 langkah 3 "Validasi file" dan langkah 6 "Upload file ke temporary MinIO key".
Modul documents hanya punya endpoint baca (list + presigned download). Tidak ada
`POST /documents` — frontend tidak bisa melampirkan file ke permohonan baru.

### A4. Endpoint approval plan tidak cocok

Plan Fase 7 menulis `/approve/level-1` dan `/approve/level-2`. Yang ada:
`/approve/level/{level}` (diubah karena Hono tidak mengompilasi segmen parsial).
Juga `/reject` tidak ada sebagai endpoint sendiri — ditangani lewat body keputusan
`accepted|rejected|cancelled` pada endpoint admin/level.

### A5. Fase 8 — yang belum ada

- rollover idempotent antar tahun: **tidak ada** (`POST /leave/quota/rollover` → 404);
- penerapan SK/policy + audit: hanya baca (`GET /leave/policy`), tidak ada jalur tulis
  (`PUT /leave/policy` → 404);
- admin eligibility override: tidak ada endpoint, hanya kolom `manual_validate`;
- aturan Cuti Besar terpisah: tidak ada.

### A6. Fase 9 — laporan discrepancy belum jadi artifact

`scripts/quota-reconcile.ts` hanya mencetak ke stdout; tidak menulis CSV/HTML seperti diminta
plan langkah 8.

### A7. `audit_logs` kosong, `leave_quota_audits` terisi

Plan Fase 7 minta "audit before/after tersimpan". Yang tersimpan hanya audit kuota (6.570 baris);
tabel `audit_logs` umum 0 baris.

## B. Fase 12 — semua modul bisnis masih kosong

32 tabel target tidak dipakai, isinya 0 baris. Sumber legacy yang menunggu:

| Modul | Tabel legacy | Baris | 1:N |
|---|---|---|---|
| Disposisi | `hlm_edispo` (+`_acc`,`_disposisi`,`_final`) | 6.790 | 6.776 |
| Alibi | `hlm_alibi` (+`_acc`) | 6.057 | — |
| Surat keterangan | `tbl_suket`, `tbl_suketmad` | 3.963 | — |
| Surat tugas | `hlm_surtug` (+`_acc`,`_ket`,`_peg`,`_tembus`) | 3.194 | 14.195 / 3.864 / 3.235 |
| Agenda | `hlm_agenda` | 2.484 | — |
| BPJS | `hlm_bpjs` (+acc) | 306 | — |
| Pensiun | `hlm_pens_reg_usul` (+acc, suket) | 302 | — |
| Karier / KARIS-KARSU | `hlm_karisu` (+acc) | 210 | — |
| Satya Lencana | `hlm_satlen` (+acc, sphd) | 174 | — |
| Gelar | `hlm_gelar` (+acc) | 173 | — |
| Izin belajar | `hlm_ibel` (+acc, sphd) | 72 | — |
| Taspen | `hlm_taspen` (+acc) | 39 | — |
| Pangkat | `hlm_pangkat`, `_jft`, `_jfu`, `_strk` | 13 | 3 jalur |
| Tugas belajar | `tugas_belajar` (+acc) | 8 | — |
| KARPEG | `hlm_karpeg` (+acc) | 7 | — |
| **Total** | | **~23.800** | |

Catatan: `hlm_pmk`, `hlm_skmi_skpp`, `tbl_admin` = 0 baris di sumber, jadi tidak ada data
untuk dimigrasi (fiturnya tetap perlu diport kalau ada input baru).

## C. Fase 13 dan 14 — belum mulai

Fase 13: generator PDF, QR verification endpoint, output PDF ke MinIO, template per modul.
Tabel `generated_letters` sudah ada, 0 baris.

Fase 14: matriks regresi penuh, cutover, retirement legacy.

## D. Temuan angka yang perlu dijelaskan

**Target lebih banyak dari sumber.** `leave_requests` target = 7.926 baris, sumber
`tbl_surat_masuk` sekarang = 7.753 baris. Selisih **+173**. Kemungkinan target dibangun dari
snapshot legacy saat masih ada 7.926 baris (duplikat approval / baris yang kemudian hilang).
Pada Fase 14 gate "count source/target cocok atau setiap selisih punya alasan" — selisih ini
belum punya alasan tertulis.

Pemulihan data: 7.752 dari 7.753 baris sumber ada di target (99,99%), hanya **1 permohonan
belum ikut termigrasi** (`TRAINING` 25-08-2025). Kolom relasi (nama, NIP, unit, `legacy_id`)
terisi lengkap, jadi datanya tidak hilang, hanya belum masuk.

## Urutan perbaikan yang disarankan

1. **Lock kuota saat create** (A1) — ini satu-satunya yang merusak data.
2. Upload lampiran user (A3) — tanpa ini alur permohonan tidak lengkap.
3. Rollover + policy tulis + override eligibility (A5) — melengkapi modul cuti.
4. Sapu bersih selisih sumber/target + generate laporan discrepancy (A6, D).
5. Fase 12 per modul, urutan: surat tugas → disposisi → alibi → sisanya.
6. Fase 13, lalu Fase 14.
