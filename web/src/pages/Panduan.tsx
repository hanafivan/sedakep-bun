import { Page } from '../components/Layout';

/**
 * Panduan penggunaan Sedakep. Dua tampilan: panduan PDF (langkah tertulis)
 * dan panduan video (daftar pemutaran). Belum ada berkas/media asli, jadi
 * halaman menampilkan ringkasan langkah — bukan tautan karangan.
 */

type Mode = 'pdf' | 'video';

const PDF_SECTIONS: Array<{ title: string; steps: string[] }> = [
  {
    title: 'Mengajukan Cuti',
    steps: [
      'Buka menu Cuti → Ajukan Cuti.',
      'Pilih jenis cuti, tanggal mulai, dan durasi.',
      'Lampirkan berkas pendukung bila jenis cuti mewajibkannya.',
      'Kirim permohonan, lalu pantau statusnya di Riwayat Pengajuan.',
    ],
  },
  {
    title: 'Memantau Status & Cetak Dokumen',
    steps: [
      'Buka Riwayat Pengajuan untuk melihat status semua pengajuan.',
      'Setelah disetujui, buka detail permohonan.',
      'Cetak surat keterangan cuti atau surat tugas lewat tombol cetak.',
      'Setiap dokumen memuat kode verifikasi yang bisa dipindai lewat QR.',
    ],
  },
  {
    title: 'Layanan Kepegawaian',
    steps: [
      'Buka menu Layanan → Layanan Kepegawaian.',
      'Pilih jenis layanan (pensiun, gelar, karpeg, BPJS, dan lainnya).',
      'Lengkapi data dan unggah dokumen yang diminta.',
      'Pantau keputusan di halaman detail permohonan.',
    ],
  },
];

const VIDEO_ITEMS: Array<{ title: string; duration: string; description: string }> = [
  {
    title: 'Tur Antarmuka Sedakep',
    duration: '03:20',
    description: 'Mengenal sidebar, topbar, dan navigasi bawah di perangkat seluler.',
  },
  {
    title: 'Mengajukan Cuti Langkah demi Langkah',
    duration: '05:10',
    description: 'Dari memilih jenis cuti hingga mengunggah lampiran dan memantau status.',
  },
  {
    title: 'Persetujuan Berjenjang untuk Atasan',
    duration: '04:05',
    description: 'Cara memeriksa dan memutuskan permohonan cuti serta surat masuk.',
  },
];

export function Panduan({ mode }: { mode: Mode }) {
  if (mode === 'video') {
    return (
      <Page title="Panduan Video" sub="Kumpulan video singkat penggunaan Sedakep">
        <div className="panel">
          <ol className="faq">
            {VIDEO_ITEMS.map((item) => (
              <li key={item.title}>
                <h3>{item.title}</h3>
                <p className="sub">
                  {item.duration} · {item.description}
                </p>
              </li>
            ))}
          </ol>
          <p className="sub">
            Video panduan akan tersedia setelah rekaman internal selesai. Hubungi admin PTSP untuk
            akses versi sementara.
          </p>
        </div>
      </Page>
    );
  }

  return (
    <Page title="Panduan PDF" sub="Langkah tertulis penggunaan Sedakep">
      <div className="panel">
        <ol className="faq">
          {PDF_SECTIONS.map((section) => (
            <li key={section.title}>
              <h3>{section.title}</h3>
              <ul>
                {section.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
        <p className="sub">
          Berkas PDF panduan resmi belum dilampirkan ke sistem. Hubungi admin PTSP untuk salinan
          cetak.
        </p>
      </div>
    </Page>
  );
}
