# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Pegawai (PNS/PPPK) dan pengelola kepegawaian di lingkungan Kantor Kementerian Agama
Kabupaten Sleman. Empat peran: `pegawai` (mengajukan sendiri), `verifikator` dan `atasan`
(memeriksa/menyetujui), serta `admin` (mengelola data, pengguna, dan kebijakan). Dipakai
saat jam kerja, oleh operator yang berpindah cepat antar daftar, formulir, dan hasil cetak.

## Product Purpose

Sistem layanan kepegawaian terpadu (PTSP) pengganti aplikasi PHP legacy: cuti dan kuota,
surat tugas, disposisi surat masuk, alibi, agenda, serta layanan kepegawaian (pensiun,
gelar, karpeg, karis/karsu, BPJS, taspen, satya lencana, izin/tugas belajar, PMK,
SKMI/SKPP, pangkat). Menyatukan pengajuan, approval berjenjang, dokumen, dan cetak dalam
satu alur. Sukses berarti: satu sumber kebenaran data, alur approval jelas, dan dokumen
siap cetak yang bisa diverifikasi.

## Positioning

Kuota cuti dihitung dari **satu engine canonical** yang memutar ulang histori permohonan
(bukan menyalin snapshot cache), sehingga saldo selalu bisa direkonstruksi dan diaudit.
Setiap dokumen cetak membawa **kode verifikasi HMAC** yang menunjuk ke halaman publik —
bukan sekadar QR dekoratif.

## Operating Context

Ruang kerja administratif: entri data berulang, pencarian/penyaringan daftar panjang
(ribuan permohonan), approval berjenjang (admin → atasan 1 → atasan 2), unggah berkas
pendukung, dan cetak surat resmi (SK cuti, surat tugas, SPHD) di kertas A4. Basis waktu
`Asia/Jakarta`. Bahasa antarmuka Indonesia.

## Capabilities and Constraints

- Runtime Bun + Hono + TypeScript; MySQL/MariaDB; MinIO/S3 untuk dokumen; React + Vite untuk web.
- RBAC 4 peran. Scoping data per unit kerja **sengaja tidak** diimplementasikan (keputusan
  arsitektur: 3 peran legacy Admin Unit/eDispo/Presensi tidak punya padanan).
- Kuota: eligibility PNS/PPPK, carry-over N-1/N-2 (maks 6 hari), reserved vs official vs
  available balance; periode tutup tahunan; rollover tahunan terjadwal.
- Dokumen memakai `documents` + `document_links` + MinIO; fallback legacy filesystem belum
  dimigrasi isi/berkasnya (ditunda).
- Cetak memakai HTML siap-print (`window.print()`); PDF server + QR untuk sebagian modul.
- Tidak ada SaaS multi-tenant, tidak ada i18n non-Indonesia.

## Brand Commitments

- Nama produk **Sedakep**; institusi **PTSP Kemenag Sleman**.
- Identitas hijau institusional Kementerian Agama (disetujui pemilik untuk redesign ini)
  sebagai warna aksen; nuansa kantor/lembaga, bukan startup tech.

## Evidence on Hand

- Data nyata di DB legacy `ptsp_sedakep` (ditampilkan sebagai contoh di UI pada mode simulasi).
- Akun demo: `admin.sedakep`, `atasan.sedakep`, `pegawai.sedakep` (kata sandi via `DEMO_PASSWORD`).
- Dokumen contoh: SK cuti, surat tugas, SPHD (cetak HTML + PDF).
- Tidak ada testimoni, logo resmi berlisensi, atau klaim pihak ketiga yang boleh dikarang.

## Product Principles

1. Angka selalu dari server; UI tidak pernah menghitung saldo/kuota sendiri.
2. Alur negara/instansi harus jelas: status, siapa berikutnya, dan apa yang tersisa.
3. Kecepatan operator lebih penting daripada hiasan; kepadatan informasi dijaga.
4. Setiap dokumen harus bisa ditelusuri dan diverifikasi.
5. Perubahan yang merusak data (kuota, approval) harus idempoten dan terekam audit.

## Accessibility & Inclusion

Target WCAG AA: kontras teks ≥ 4.5:1, navigasi keyboard penuh (fokus terlihat), label form
eksplisit, dan tabel yang terbaca pembaca layar. Banyak pengguna adalah staf kantor lintas usia.
