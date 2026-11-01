import { badRequest } from '../../../shared/errors';
import { insertAuditLog } from '../command';
import { getQuota } from './quota.domain';
import { canViewRequest, getLeaveRequestDetail } from './leave.domain';

/**
 * Service pembuatan dokumen PDF untuk cuti (SK Cuti Resmi & Formulir BKN).
 *
 * Mengorkestrasi pembuatan PDF, kode QR verifikasi, dan penyimpanan dokumen ke MinIO.
 */

const yearOf = (value: string | Date): number => Number(String(value).slice(0, 4));

const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const formatDateId = (value: string | null | undefined): string => {
  if (!value) return '-';
  const parts = String(value).slice(0, 10).split('-');
  if (parts.length !== 3) return String(value);
  const [y, m, d] = parts;
  return `${Number(d)} ${MONTHS_ID[Number(m) - 1] ?? m} ${y}`;
};

/**
 * Saldo yang dicetak pada formulir.
 *
 * Angka manual yang dicatat admin saat memutuskan (legacy `tahunan_n*`)
 * diutamakan — itulah yang dilihat pegawai di berkas resmi. Kalau admin tidak
 * mengisinya, dipakai hasil hitung engine supaya formulir tetap terisi.
 */
const printQuotaBuckets = async (
  detail: Record<string, unknown>,
  year: number,
): Promise<{ n: number; n1: number; n2: number }> => {
  const n = detail.legacy_quota_n as number | null;
  const n1 = detail.legacy_quota_n1 as number | null;
  const n2 = detail.legacy_quota_n2 as number | null;
  if (n !== null && n !== undefined) {
    return { n: Number(n), n1: Number(n1 ?? 0), n2: Number(n2 ?? 0) };
  }
  try {
    const quota = await getQuota(Number(detail.user_id), year);
    return { n: quota.available.n, n1: quota.available.n1, n2: quota.available.n2 };
  } catch {
    return { n: 12, n1: 0, n2: 0 };
  }
};

/** Hasilkan PDF surat keterangan cuti (SK) + QR resmi Kemenag Sleman, simpan ke MinIO. */
export const generateLeaveLetterPdf = async (
  id: number,
  actor: { id: number | string; role?: string },
) => {
  const detail = await getLeaveRequestDetail(id);
  const letter = (detail.letters as Array<Record<string, unknown>>).find(
    (item) => item.letter_type === 'suket',
  );
  if (!letter) throw badRequest('Terbitkan surat keterangan (SK) sebelum mencetak PDF');

  const { buildLeaveLetterOfficialPdf } = await import('../../../shared/pdf');
  const { verifyUrl } = await import('../../../shared/verify');
  const link = verifyUrl('leave_requests', id);
  const instance = (detail.instance ?? {}) as Record<string, string | null>;

  const pdf = await buildLeaveLetterOfficialPdf({
    number: String(letter.number ?? '-'),
    issued_at: String(letter.issued_at ?? new Date().toISOString().slice(0, 10)),
    name: detail.name,
    nip: detail.nip,
    grade: detail.grade,
    position: detail.position,
    organization: detail.organization_name,
    leave_type: detail.leave_type,
    duration: detail.duration,
    duration_unit: detail.duration_unit,
    start_date: detail.start_date as string,
    end_date: detail.end_date as string,
    reason: detail.reason,
    address: detail.address,
    phone: detail.phone,
    official_position: String(letter.official_position ?? instance.head_name ?? 'Kepala'),
    official_name: String(letter.official_name ?? instance.head_name ?? 'Sidik Pramono, S.Ag, M.Si'),
    instance_name: instance.name,
    instance_address: instance.address,
    verify_url: link,
  });

  const { uploadDocument, getDownloadUrl } = await import('../../documents/domain');
  const uploaded = await uploadDocument({
    buffer: Buffer.from(pdf),
    filename: `sk-cuti-${String(letter.number ?? id)}.pdf`,
    mimeType: 'application/pdf',
    entityTable: 'leave_requests',
    entityId: id,
    field: 'sk_pdf',
    label: 'PDF surat keterangan cuti',
    actorId: Number(actor.id),
  });
  const download = await getDownloadUrl(uploaded.id);
  await insertAuditLog({
    actor_id: Number(actor.id),
    action: 'leave_letter_pdf_generate',
    entity_table: 'leave_requests',
    entity_id: id,
    after_data: { document_id: uploaded.id },
  });
  return { document_id: uploaded.id, url: download.url, verify_url: link };
};

/** Hasilkan PDF Formulir Permintaan dan Pemberian Cuti BKN (8 Bagian), simpan ke MinIO. */
export const generateLeaveFormPdf = async (
  id: number,
  actor: { id: number | string; role?: string },
) => {
  const detail = await getLeaveRequestDetail(id);
  if (actor.role && !canViewRequest(actor as { id: number | string; role: string }, detail)) {
    throw badRequest('Tidak berhak mencetak formulir cuti pegawai lain');
  }

  const { buildBknLeaveFormPdf } = await import('../../../shared/pdf');
  const instance = (detail.instance ?? {}) as Record<string, string | null>;
  const year = yearOf(detail.start_date as string);

  const buckets = await printQuotaBuckets(detail as Record<string, unknown>, year);

  const pdf = await buildBknLeaveFormPdf({
    name: detail.name,
    nip: detail.nip,
    grade: detail.grade,
    position: detail.position,
    organization: detail.organization_name,
    address: detail.address,
    phone: detail.phone,
    leave_type: detail.leave_type,
    duration: detail.duration,
    duration_unit: detail.duration_unit,
    start_date: detail.start_date as string,
    end_date: detail.end_date as string,
    reason: detail.reason,
    quota_n: buckets.n,
    quota_n1: buckets.n1,
    quota_n2: buckets.n2,
    approver_1_name: detail.approver_1_name,
    approver_1_nip: detail.approver_1_nip,
    approver_1_position: detail.approver_1_position,
    approver_2_name: detail.approver_2_name,
    approver_2_nip: detail.approver_2_nip,
    approver_2_position: detail.approver_2_position,
    instance_name: instance.name,
    instance_address: instance.address,
  });

  const { uploadDocument, getDownloadUrl } = await import('../../documents/domain');
  const uploaded = await uploadDocument({
    buffer: Buffer.from(pdf),
    filename: `formulir-cuti-bkn-${id}.pdf`,
    mimeType: 'application/pdf',
    entityTable: 'leave_requests',
    entityId: id,
    field: 'bkn_form_pdf',
    label: 'PDF Formulir Cuti BKN',
    actorId: Number(actor.id),
  });
  const download = await getDownloadUrl(uploaded.id);
  await insertAuditLog({
    actor_id: Number(actor.id),
    action: 'leave_form_pdf_generate',
    entity_table: 'leave_requests',
    entity_id: id,
    after_data: { document_id: uploaded.id },
  });
  return { document_id: uploaded.id, url: download.url };
};

