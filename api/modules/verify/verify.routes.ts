import { OpenAPIHono } from '@hono/zod-openapi';
import { notFound } from '../../shared/errors';
import { defaultHook } from '../../shared/openapi-hook';
import { successBody } from '../../shared/response';
import { readVerifyCode, verifyUrl } from '../../shared/verify';
import {
  findAlibiSummary,
  findAssignmentSummary,
  findIncomingSummary,
  findLeaveSummary,
  findLeaveFullDetailForVerify,
  findInstanceForVerify,
  findServiceSummary,
} from './query';
import { renderInvalidCodeHtml, renderVerifiedLeaveFormHtml } from './html';

/**
 * Verifikasi dokumen cetak lewat QR. PUBLIK (tanpa bearer) — siapa pun yang
 * memindai surat boleh memeriksa keasliannya.
 * Jika dibuka di browser (pindai kamera ponsel/browser), menyajikan halaman formulir
 * lengkap dengan popup modal 'Dokumen Valid'.
 * Jika dipanggil sebagai API (Accept: application/json), mengembalikan JSON.
 */

export const verifyRoutes = new OpenAPIHono({ defaultHook });

verifyRoutes.get('/verify/:code', async (c) => {
  const code = c.req.param('code');
  const payload = readVerifyCode(code);
  const accept = c.req.header('accept') || '';
  const isHtml = !c.req.path.startsWith('/api/') && (accept.includes('text/html') || !accept.includes('application/json'));

  if (!payload) {
    if (isHtml) {
      return c.html(renderInvalidCodeHtml(code), 404);
    }
    return c.json(
      { success: false, data: null, message: 'Kode verifikasi tidak valid', code: 404 },
      404,
    );
  }

  let summary: Record<string, unknown> | null = null;
  let leaveDetail: any = null;
  let instanceInfo: any = null;

  try {
    if (payload.t === 'assignment_letters') {
      const row = await findAssignmentSummary(payload.i);
      if (row) {
        summary = {
          document: 'Surat Tugas',
          number: row.letter_number,
          code: row.code,
          period: `${row.start_date ?? '-'} — ${row.end_date ?? '-'}`,
          status: row.status,
          decision: row.decision,
          signer: row.signer_name,
        };
      }
    } else if (payload.t === 'leave_requests') {
      const [row, fullDetail, instance] = await Promise.all([
        findLeaveSummary(payload.i),
        findLeaveFullDetailForVerify(payload.i),
        findInstanceForVerify(),
      ]);
      if (row || fullDetail) {
        summary = {
          document: 'Formulir Permohonan Cuti',
          number: row?.letter_number ?? fullDetail?.letter_number,
          name: row?.name ?? fullDetail?.name,
          leave_type: row?.leave_type ?? fullDetail?.leave_type,
          period: `${(row?.start_date ?? fullDetail?.start_date) ?? '-'} — ${(row?.end_date ?? fullDetail?.end_date) ?? '-'}`,
          status: row?.status ?? fullDetail?.status,
        };
        leaveDetail = fullDetail ?? row;
        instanceInfo = instance;
      }
    } else if (payload.t === 'service_requests') {
      const row = await findServiceSummary(payload.i);
      if (row) {
        summary = {
          document: 'Surat Layanan Kepegawaian',
          service_type: row.service_type,
          name: row.name,
          title: row.title,
          status: row.status,
          decision: row.decision,
        };
      }
    } else if (payload.t === 'incoming_letters') {
      const row = await findIncomingSummary(payload.i);
      if (row) {
        summary = {
          document: 'Surat Masuk',
          number: row.letter_number,
          agenda: row.agenda_number,
          origin: row.origin,
          received_date: row.received_date,
          status: row.status,
        };
      }
    } else if (payload.t === 'alibi_requests') {
      const row = await findAlibiSummary(payload.i);
      if (row) {
        summary = {
          document: 'Surat Keterangan Alibi',
          name: row.name,
          alibi_type: row.alibi_type,
          alibi_date: row.alibi_date,
          status: row.status,
        };
      }
    } else {
      if (isHtml) return c.html(renderInvalidCodeHtml(code), 404);
      throw notFound('Jenis dokumen tidak dikenal');
    }
  } catch (err) {
    if (isHtml) return c.html(renderInvalidCodeHtml(code), 500);
    throw err;
  }

  if (!summary) {
    if (isHtml) return c.html(renderInvalidCodeHtml(code), 404);
    throw notFound('Dokumen tidak ditemukan');
  }

  // Jika dibuka di browser (pindai kamera HP / QR scanner), sajikan tampilan form & popup valid
  if (isHtml) {
    if (payload.t === 'leave_requests' && leaveDetail) {
      return c.html(renderVerifiedLeaveFormHtml(leaveDetail, instanceInfo, code), 200);
    }
  }

  // Respons JSON untuk API klien SPA
  return c.json(
    successBody(
      {
        valid: true,
        entity: payload.t,
        entity_id: payload.i,
        leave_detail: leaveDetail,
        instance: instanceInfo,
        ...summary,
      },
      'Dokumen terverifikasi',
    ),
    200,
  );
});

/** Gambar QR (PNG) untuk kode verifikasi — dipakai tampilan cetak HTML. */
verifyRoutes.get('/verify/:code/qr', async (c) => {
  const code = c.req.param('code');
  const payload = readVerifyCode(code);
  if (!payload) {
    return c.json({ success: false, data: null, message: 'Kode tidak valid', code: 404 }, 404);
  }
  const QRCode = (await import('qrcode')).default;
  const png = await QRCode.toBuffer(verifyUrl(payload.t, payload.i), {
    type: 'png',
    margin: 1,
    width: 240,
  });
  return new Response(new Uint8Array(png), {
    status: 200,
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' },
  });
});
