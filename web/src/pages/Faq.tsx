import { Page } from '../components/Layout';

/**
 * FAQ Cuti PNS — isi disalin apa adanya dari `faq_cuti.php` legacy
 * (ringkasan Peraturan BKN No. 7 Tahun 2021). Tidak diambil dari API karena
 * ini teks kebijakan, bukan data.
 */

const SECTIONS: Array<{ title: string; items: Array<{ label?: string; text: string }> }> = [
  {
    title: 'Cuti Tahunan',
    items: [
      { label: 'Syarat', text: 'Telah bekerja minimal 1 tahun secara terus menerus.' },
      { label: 'Lama Cuti', text: '12 hari kerja.' },
      {
        label: 'Sisa Cuti N-1',
        text: 'Maksimal 6 hari kerja dapat dibawa dan digunakan di tahun berikutnya.',
      },
      {
        label: 'Sisa Cuti N-2',
        text: 'Maksimal 6 hari kerja dapat dibawa dan digunakan di tahun berjalan.',
      },
    ],
  },
  {
    title: 'Cuti Besar',
    items: [
      { label: 'Syarat', text: 'Telah bekerja minimal 5 tahun terus menerus.' },
      { label: 'Lama Cuti', text: 'Maksimal 3 bulan.' },
      {
        label: 'Ketentuan',
        text: 'Saat mengambil cuti besar, tidak berhak atas cuti tahunan di tahun tersebut. Gaji, tunjangan keluarga, dan tunjangan pangan tetap dibayarkan.',
      },
      {
        label: 'Ibadah Haji Pertama Kali',
        text: 'Dikecualikan dari syarat 5 tahun kerja.',
      },
    ],
  },
  {
    title: 'Cuti Sakit',
    items: [
      { label: 'Sakit 1 Hari', text: 'Wajib surat keterangan dokter.' },
      {
        label: 'Sakit > 1 Hari',
        text: 'Wajib pengajuan tertulis dilampiri surat dokter.',
      },
      {
        label: 'Sakit Berkepanjangan',
        text: 'Maksimal 1 tahun (bisa ditambah 6 bulan dengan surat keterangan tim penguji kesehatan).',
      },
      {
        label: 'Kondisi Khusus',
        text: 'Keguguran mendapat cuti sakit maksimal 1,5 bulan. Kecelakaan kerja ditanggung sampai sembuh. Gaji & tunjangan tetap dibayarkan penuh.',
      },
    ],
  },
  {
    title: 'Cuti Kelahiran (Melahirkan)',
    items: [
      {
        label: 'Anak ke 1-3',
        text: 'Maksimal 3 bulan. Gaji, tunjangan keluarga, tunjangan pangan, dan tunjangan jabatan tetap dibayarkan.',
      },
      { label: 'Anak ke 4 dst', text: 'Menggunakan hak Cuti Besar.' },
      {
        label: 'Bagi Suami PNS',
        text: 'Dapat mengajukan Cuti Alasan Penting saat istri melahirkan/caesar dengan melampirkan surat rawat inap.',
      },
    ],
  },
  {
    title: 'Cuti Alasan Penting',
    items: [
      {
        label: 'Syarat',
        text: 'Keluarga inti (orang tua, istri/suami, anak, mertua, menantu, kakak, adik) sakit keras/meninggal dunia, atau mengurus warisan, melangsungkan pernikahan, istri melahirkan, bencana alam.',
      },
      {
        label: 'Lama Cuti',
        text: 'Maksimal 1 bulan. Gaji dan tunjangan tetap dibayarkan.',
      },
    ],
  },
  {
    title: 'Cuti Bersama',
    items: [
      {
        label: 'Ketentuan',
        text: 'Cuti bersama tidak mengurangi hak cuti tahunan. Bagi PNS yang karena jabatannya tidak mendapat cuti bersama, hak cuti tahunannya akan ditambah.',
      },
    ],
  },
  {
    title: 'Cuti di Luar Tanggungan Negara (CLTN)',
    items: [
      { label: 'Syarat Umum', text: 'Bekerja minimal 5 tahun.' },
      {
        label: 'Alasan yang Boleh',
        text: 'Ikut suami/istri tugas negara, program keturunan, merawat keluarga sakit khusus.',
      },
      {
        label: 'Lama Cuti',
        text: 'Maksimal 3 tahun (bisa diperpanjang 1 tahun).',
      },
      {
        label: 'Ketentuan',
        text: 'Tidak menerima penghasilan PNS, masa kerja tidak dihitung, dan diberhentikan sementara dari jabatannya.',
      },
    ],
  },
];

const BKN_SOURCE = 'https://www.bkn.go.id/storage/2025/04/Buku-Saku-FAQ-Cuti-PNS.pdf';

export function Faq() {
  return (
    <Page
      title="FAQ Cuti PNS"
      sub="Ringkasan FAQ Cuti PNS (Berdasarkan Peraturan BKN No 7 Tahun 2021)"
    >
      <div className="panel">
        <ol className="faq">
          {SECTIONS.map((section) => (
            <li key={section.title}>
              <h3>{section.title}</h3>
              <ul>
                {section.items.map((item) => (
                  <li key={item.label ?? item.text}>
                    {item.label ? <strong>{item.label}:</strong> : null} {item.text}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>

        <p className="sub">
          Dokumen asli:{' '}
          <a href={BKN_SOURCE} target="_blank" rel="noopener noreferrer">
            Buku Saku FAQ Cuti PNS (BKN)
          </a>
          .
        </p>
      </div>
    </Page>
  );
}
