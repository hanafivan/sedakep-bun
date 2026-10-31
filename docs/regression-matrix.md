# Matriks Regresi — Sedakep (TypeScript/Hono)

Pemetaan matriks regresi Fase 14 ke berkas tes yang menjaganya. Jalankan dengan
`NODE_ENV=development bun test` (memakai DB uji `sedakep_test`).

## Kuota & cuti

| Kasus | Berkas |
|---|---|
| PNS vs PPPK (aturan jenis cuti) | `tests/quota-engine.test.ts`, `tests/leave-endpoints.test.ts` |
| Missing TMT / belum eligible | `tests/quota-engine.test.ts` |
| Eligible & belum eligible | `tests/quota-engine.test.ts` |
| Request 0 / 1 / 6 / 12 / >12 hari | `tests/quota-engine.test.ts` |
| Tahun berjalan, N-1, N-2 | `tests/quota-engine.test.ts` |
| Final, parsial, pending, ditolak, dibatalkan | `tests/quota-engine.test.ts`, `tests/leave-api.test.ts` |
| Edit dengan exclude current | `tests/leave-api.test.ts` (`updateLeaveRequestById`) |
| Concurrent submit (anti-oversubscribe) | `tests/leave-api.test.ts`, `tests/leave-letters.test.ts` (nomor paralel) |
| Rollover, N-2 expiry, policy/SK, override, Cuti Besar | `tests/quota-engine.test.ts`, `tests/leave-endpoints.test.ts` |
| Durasi anomali / negatif / unit Tahun | `tests/quota-engine.test.ts` |
| Lampiran wajib per jenis | `tests/leave-attachment.test.ts` |
| Periode tutup | `tests/leave-closure.test.ts` |

## Modul Fase 12

| Kasus | Berkas |
|---|---|
| Surat tugas (CRUD, anggota/keterangan/tembusan, nomor, cancel, PDF+QR) | `tests/assignment-api.test.ts`, `tests/pdf-verify.test.ts` |
| Alibi (approval 3 tingkat, cancel, berkas) | `tests/alibi-api.test.ts` |
| Disposisi (surat masuk, klasifikasi, disposisi, final, referensi, finalisasi) | `tests/dispositions-api.test.ts` |
| Agenda (CRUD, laporan, berkas) | `tests/agenda-api.test.ts` |
| Layanan kepegawaian generik (pensiun/gelar/…/pangkat) | `tests/service-requests-api.test.ts` |

## Dokumen, PDF, dan verifikasi

| Kasus | Berkas |
|---|---|
| Upload/unduh/presigned/checksum storage | `tests/storage.test.ts` |
| PDF surat + unggah ke MinIO + QR | `tests/pdf-verify.test.ts` |
| Verifikasi QR (kode HMAC, kode palsu 404) | `tests/pdf-verify.test.ts` |
| Dokumen bucket tidak null (unggahan) | `tests/leave-endpoints.test.ts` |

## Keamanan & arsitektur

| Kasus | Berkas |
|---|---|
| Auth dasar, bearer, role admin | `tests/auth.test.ts` |
| Admin cuti 403 untuk pegawai | `tests/leave-admin.test.ts` |
| Batas modul (SQL hanya di query/command, domain murni) | `tests/architecture.test.ts`, `tests/architecture-leave.test.ts`, guard di `tests/assignment-api.test.ts` / `alibi-api` / `dispositions-api` / `service-requests-api` |
| Kontrak OpenAPI (semua path) | `tests/docs.test.ts` |

## Status

- **Otomatis:** seluruh baris di atas hijau (`bun test` 153 lulus / 0 gagal per 13 Okt 2026).
- **Belum dijalankan:** matriks manual end-to-end via proxy Vite untuk modul baru (Disposisi,
  Layanan, Agenda, Alibi) — bukti tulis sudah lewat tes API di DB uji; smoke proxy penuh
  menunggu sesi browser.
- **Bergantung keputusan:** migrasi isi berkas/baris lama (Fase 9/10) dan cutover (lihat
  `docs/cutover-runbook.md`).
