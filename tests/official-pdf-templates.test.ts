import { describe, expect, it } from 'bun:test';
import {
  buildAssignmentLetterPdf,
  buildAlibiLetterPdf,
  buildDispositionSheetPdf,
  buildServiceStatementLetterPdf,
} from '../api/shared/pdf';

describe('Official F4 PDF Templates (Kemenag Sleman)', () => {
  it('menghasilkan PDF Surat Tugas sesuai template resmi FPDF legacy', async () => {
    const pdf = await buildAssignmentLetterPdf({
      id: 1,
      letter_number: 'B-100/Kk.12.04/1/Kp.04.1/11/2026',
      number_display: 'Nomor : B-100/Kk.12.04/1/Kp.04.1/11/2026',
      consideration: 'Dalam rangka meningkatkan kualitas pelayanan kepegawaian',
      legal_basis: '1. UU No. 5 Tahun 2014\n2. PMA No. 19 Tahun 2019',
      content: 'Melaksanakan monitoring dan evaluasi terpadu di KUA Depok',
      start_date: '2026-11-10',
      end_date: '2026-11-10',
      day_start: 'Selasa',
      day_end: 'Selasa',
      place: 'KUA Kapanewon Depok',
      time_start: '08:00',
      time_end: '15:00',
      signer_name: 'H. Sidik Pramono, S.Ag., M.Si.',
      signer_position: 'Kepala Kantor',
      status: 'approved',
      decision: 'accepted',
      members: [
        {
          name: 'Ahmad Fauzi, S.Kom.',
          nip: '198501012010011005',
          grade: 'III/c',
          position: 'Pranata Komputer Ahli Muda',
          organization_name: 'Subbagian Tata Usaha',
        },
      ],
      notes: [{ note: 'Biaya dibebankan pada DIPA Kantor Kemenag Sleman' }],
      copies: [{ copy_to: 'Kepala Kanwil Kemenag DIY' }],
      verify_url: 'https://sleman.kemenag.go.id/sedakep/verify/ST123',
    });

    expect(pdf).toBeInstanceOf(Uint8Array);
    expect(pdf.byteLength).toBeGreaterThan(50000);
    const header = Buffer.from(pdf.slice(0, 5)).toString();
    expect(header).toBe('%PDF-');
  });

  it('menghasilkan PDF Surat Alibi 100% presisi FPDF legacy', async () => {
    const pdf = await buildAlibiLetterPdf({
      id: 2,
      name: 'Siti Aminah, S.Pd.I.',
      nip: '199002152015032001',
      grade: 'III/b',
      position: 'Guru Ahli Pertama',
      organization_name: 'MTsN 1 Sleman',
      alibi_date: '2026-11-04',
      alibi_type: '2', // terlambat masuk kerja
      reason: 'Mengantar orang tua berobat ke RS Sardjito',
      time_start: '07:30',
      time_end: '09:00',
      approver_1_name: 'Drs. H. Suwandi',
      approver_1_nip: '197005121995031001',
      approver_1_position: 'Kepala MTsN 1 Sleman',
      approver_2_name: 'H. Sidik Pramono, S.Ag., M.Si.',
      approver_2_nip: '196903271997031002',
      approver_2_position: 'Kepala Kantor Kemenag Kab. Sleman',
      status: 'approved',
      printed_at: '2026-11-04',
      verify_url: 'https://sleman.kemenag.go.id/sedakep/verify/ALB123',
    });

    expect(pdf).toBeInstanceOf(Uint8Array);
    expect(pdf.byteLength).toBeGreaterThan(40000);
    const header = Buffer.from(pdf.slice(0, 5)).toString();
    expect(header).toBe('%PDF-');
  });

  it('menghasilkan PDF Lembar Disposisi sesuai grid layout FPDF legacy', async () => {
    const pdf = await buildDispositionSheetPdf({
      id: 3,
      letter_number: '045/B/Kemenag/2026',
      agenda_number: 'AG-1024',
      letter_date: '2026-11-02',
      ticket_number: 'TCK-9901',
      received_date: '2026-11-03',
      classification_code: 'KP.01.2',
      origin: 'Kanwil Kementerian Agama DIY',
      content: 'Undangan Rapat Koordinasi Program Kerja Triwulan IV',
      reviewer_checked: true,
      dispositions: [
        {
          target_name: 'Kasubbag Tata Usaha',
          instruction: 'Tindak lanjuti dan siapkan bahan paparan',
          notes: 'Koordinasikan dengan seluruh Kasi',
        },
      ],
      finals: [
        {
          name: 'Pranata Humas',
          instruction: 'Siapkan dokumentasi dan publikasi kegiatan',
        },
      ],
      officer_name: 'Budi Santoso',
      verify_url: 'https://sleman.kemenag.go.id/sedakep/verify/DSP123',
    });

    expect(pdf).toBeInstanceOf(Uint8Array);
    expect(pdf.byteLength).toBeGreaterThan(40000);
    const header = Buffer.from(pdf.slice(0, 5)).toString();
    expect(header).toBe('%PDF-');
  });

  it('menghasilkan PDF SPHD & SPPID Layanan Kepegawaian presisi FPDF legacy', async () => {
    const sphdPdf = await buildServiceStatementLetterPdf({
      id: 4,
      letter_type: 'sphd',
      letter_number: '123',
      employee_name: 'Bambang Irawan, S.E.',
      employee_nip: '197508101998031003',
      birth_place: 'Sleman',
      birth_date: '1975-08-10',
      employee_grade: 'IV/a',
      employee_position: 'Penyusun Rencana Mutasi',
      employee_organization: 'Subbagian Tata Usaha',
      issued_at: '2026-11-04',
      verify_url: 'https://sleman.kemenag.go.id/sedakep/verify/SPHD123',
    });

    expect(sphdPdf).toBeInstanceOf(Uint8Array);
    expect(sphdPdf.byteLength).toBeGreaterThan(40000);

    const sppidPdf = await buildServiceStatementLetterPdf({
      id: 5,
      letter_type: 'sppid',
      letter_number: '124',
      employee_name: 'Bambang Irawan, S.E.',
      employee_nip: '197508101998031003',
      birth_place: 'Sleman',
      birth_date: '1975-08-10',
      employee_grade: 'IV/a',
      employee_position: 'Penyusun Rencana Mutasi',
      employee_organization: 'Subbagian Tata Usaha',
      issued_at: '2026-11-04',
      verify_url: 'https://sleman.kemenag.go.id/sedakep/verify/SPPID123',
    });

    expect(sppidPdf).toBeInstanceOf(Uint8Array);
    expect(sppidPdf.byteLength).toBeGreaterThan(40000);
  });
});

