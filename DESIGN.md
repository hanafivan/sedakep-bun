---
name: Sedakep
description: Sistem layanan kepegawaian PTSP Kemenag Sleman — hijau institusional di atas netral parchment.
colors:
  kemenag-green: "#0e6b3c"
  kemenag-green-deep: "#0a5630"
  kemenag-green-ink: "#e4efe6"
  on-color: "#ffffff"
  paper: "#f4f1e8"
  surface: "#fffdf7"
  surface-sunken: "#efeadd"
  ink: "#1b2a23"
  muted: "#5c6b62"
  line: "#e0d9c8"
  line-strong: "#cbc3ad"
  gold-seal: "#9a6a12"
  status-ok: "#157a4a"
  status-warn: "#9a6a12"
  status-bad: "#b23a34"
  status-bad-deep: "#982f29"
  print-paper: "#fff"
  print-ink: "#111"
  print-rule: "#999"
  print-line: "#ddd"
  print-muted: "#444"
typography:
  display:
    fontFamily: '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif'
    fontSize: "26px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  stat:
    fontFamily: '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif'
    fontSize: "30px"
    fontWeight: 600
    lineHeight: 1.1
  heading-xl:
    fontFamily: '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif'
    fontSize: "24px"
    fontWeight: 600
  brand:
    fontFamily: '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif'
    fontSize: "21px"
    fontWeight: 600
  title:
    fontFamily: '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif'
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.3
  title-sm:
    fontFamily: '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif'
    fontSize: "15px"
    fontWeight: 600
  body:
    fontFamily: 'ui-sans-serif, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.55
  ui-lg:
    fontFamily: 'ui-sans-serif, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    fontSize: "13.5px"
    fontWeight: 400
  table:
    fontFamily: 'ui-sans-serif, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    fontSize: "13px"
    fontWeight: 400
  label:
    fontFamily: 'ui-sans-serif, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    fontSize: "12.5px"
    fontWeight: 600
  dense:
    fontFamily: 'ui-sans-serif, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    fontSize: "12px"
    fontWeight: 400
  caption:
    fontFamily: 'ui-sans-serif, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    fontSize: "11.5px"
    fontWeight: 600
  micro:
    fontFamily: 'ui-sans-serif, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    fontSize: "11px"
    fontWeight: 700
  mono:
    fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace'
    fontSize: "13px"
  print:
    fontFamily: '"Times New Roman", Times, serif'
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  print-title:
    fontFamily: '"Times New Roman", Times, serif'
    fontSize: "18px"
    fontWeight: 400
rounded:
  xs: "4px"
  sm: "9px"
  md: "12px"
  lg: "16px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.kemenag-green}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: "9px 15px"
  button-primary-hover:
    backgroundColor: "{colors.kemenag-green-deep}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "9px 15px"
  input:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "9px 12px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "20px"
  nav-active:
    backgroundColor: "{colors.kemenag-green}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: "8px 10px"
  badge:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.muted}"
    rounded: "{rounded.pill}"
    padding: "3px 10px"
---

# Design System: Sedakep

## Overview

**Creative North Star: "Meja Kerja Kantor"**

Sistem ini adalah meja kerja sebuah kantor kementerian: tenang, padat, dan dapat
dipercaya. Hijau institusional Kementerian Agama muncul sebagai tinta utama — pada
aksi, navigasi aktif, dan status — sementara latar parchment hangat dan tipografi serif
memberi nuansa dokumen resmi, bukan dasbor startup. Warna tidak pernah menjadi hiasan;
ia menandai makna (status, prioritas, tautan).

Mode dominan adalah **Operate**: pengguna menyelesaikan tugas administratif dengan cepat,
berpindah antar daftar panjang, formulir, dan hasil cetak. Karena itu kepadatan informasi
dijaga, hierarki tegas, dan setiap kontrol menyebut aksinya. Dunia ini **light-first**
karena dipakai di ruang kantor bercahaya; dokumen cetak tetap kertas putih dengan serif
resmi, diselaraskan lewat aksen hijau pada kop.

**Key Characteristics:**

- Parchment hangat + hijau institusional; satu aksen, dipakai dengan disiplin.
- Tipografi editorial: serif untuk judul/angka besar, sans untuk UI, mono untuk NIP/nomor/kunci.
- Shell sidebar berkepadatan sedang; kartu bersandar pada garis, bukan bayangan ganda.
- Status selalu berbentuk badge bertinta; angka tabular pada tabel.

## Colors

Palet dua kutub: netral parchment hangat sebagai tanah, dan satu hijau institusional
sebagai tinta tindakan. Status memakai hijau/amber/merah yang diturunkan agar tidak
bertabrakan dengan warna aksi. Dunia cetak memakai netral hitam-putih sendiri
(`print-*`) karena dicetak di kertas putih.

- **Kemenag Green (#0e6b3c) — Tinta Aksi.** Tombol utama, item nav aktif, tautan, fokus.
  Selalu diringankan oleh `kemenag-green-ink` sebagai latar sorotan.
- **Paper & Surface (#f4f1e8 / #fffdf7) — Tanah.** Latar aplikasi dan permukaan panel/tabel.
- **Ink & Muted (#1b2a23 / #5c6b62) — Teks.** Judul dan isi; muted untuk label sekunder.
- **Status (ok/warn/bad)** hanya di badge dan angka; jangan pakai sebagai latar besar.

## Typography

Dua suara: serif editorial untuk suara lembaga, sans untuk kerja sehari-hari, mono untuk
identitas dan angka yang harus sejajar.

- **Display/Title/Stat — Iowan Old Style/Palatino/Georgia.** Judul halaman (26px), judul panel (17px), angka statistik (30px).
- **Body/Label — system sans.** 14px/1.55 untuk isi; 12.5px tebal untuk label form dan header tabel (uppercase, tracking lebar).
- **Mono — identitas teknis.** NIP, nomor surat, dan kunci pengaturan memakai mono + `tabular-nums`.
- **Print — Times New Roman** hanya di dalam `.print-sheet` (dokumen resmi).

## Layout

- Sidebar tetap 246px kiri dengan nav bergrup (Kerja / Layanan / Data / Akun); konten maksimum 1200px.
- Ritme spasi 4/8: jarak di atas judul selalu lebih besar daripada di bawahnya.
- `.split` dua kolom (2fr/1fr) untuk detail; `.grid2` untuk pasangan field.
- Di bawah 900px sidebar menjadi panel geser dengan tombol "Menu"; konten satu kolom.

## Elevation & Depth

**Garis lebih dulu, bayangan terakhir.** Panel, kartu, dan tabel memakai border 1px `--line`
di atas `--surface`; kedalaman tidak dinyatakan dua kali. Bayangan lembut (`--shadow`)
hanya untuk elemen terapung: kartu login, dan panel sidebar saat terbuka di ponsel.

## Shapes

Sudut lembut dan konsisten: input/tombol `9px`, panel `12px`, kartu login `16px`, badge
bulat penuh. Tidak ada sudut tajam atau pil besar pada kontrol besar. Ikon/tanda status
memakai titik bulat kecil, bukan bentuk dekoratif.

## Components

- **button-primary** — hijau, teks putih, radius 9px; hover `kemenag-green-deep`.
- **button-secondary** — permukaan putih + border; untuk aksi sekunder.
- **input/select/textarea** — `surface-sunken`, border `line-strong`; fokus border hijau + ring 3px lembut.
- **panel** — `surface`, border, radius 12px, padding 20px.
- **nav-link** — teks netral dengan titik penanda; aktif = latar hijau, teks putih.
- **badge** — pil bertinta sesuai status (ok/warn/bad/muted).
- **table** — header uppercase muted, baris seling, hover `kemenag-green-ink`, angka tabular.

## Do's and Don'ts

- **Do** pakai hijau hanya untuk aksi/makna; **Don't** mewarnai latar atau teks besar dengannya.
- **Do** nyatakan kedalaman dengan border; **Don't** menumpuk border + bayangan lebar (kartu hantu).
- **Do** gunakan serif untuk judul/angka besar; **Don't** memakai serif untuk isi/paragraf.
- **Do** tampilkan status sebagai badge; **Don't** menghitung atau menebak angka di klien.
- **Do** jaga kontras teks ≥ 4.5:1; **Don't** memakai abu untuk teks sekunder di atas permukaan berwarna.
