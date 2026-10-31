import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../config';

/**
 * Kode verifikasi dokumen cetak.
 *
 * QR pada PDF menunjuk ke `${publicBaseUrl}/verify/{code}`. Kode = payload
 * (tabel+id entitas) yang ditandatangani HMAC, supaya tautan tidak bisa
 * ditebak/di-enumerasi dan tidak membocorkan id mentah.
 */

export type VerifyPayload = { t: string; i: number };

const sign = (payload: string) =>
  createHmac('sha256', config.jwt.secret).update(payload).digest('base64url');

export const makeVerifyCode = (entityTable: string, entityId: number): string => {
  const payload = Buffer.from(JSON.stringify({ t: entityTable, i: entityId })).toString(
    'base64url',
  );
  return `${payload}.${sign(payload)}`;
};

export const readVerifyCode = (code: string): VerifyPayload | null => {
  const dot = code.lastIndexOf('.');
  if (dot <= 0) return null;
  const payload = code.slice(0, dot);
  const signature = code.slice(dot + 1);
  const expected = sign(payload);
  if (signature.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString()) as VerifyPayload;
    if (typeof parsed.t === 'string' && typeof parsed.i === 'number' && parsed.i > 0) {
      return { t: parsed.t, i: parsed.i };
    }
  } catch {
    return null;
  }
  return null;
};

export const verifyUrl = (entityTable: string, entityId: number): string =>
  `${config.publicBaseUrl}/verify/${makeVerifyCode(entityTable, entityId)}`;
