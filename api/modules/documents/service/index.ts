import { createHash } from 'node:crypto';
import { extname } from 'node:path';
import { config } from '../../../config';
import { badRequest, forbidden, notFound } from '../../../shared/errors';
import { getStorage } from '../../../shared/storage';
import {
  deleteDocument as deleteDocumentRow,
  insertDocument,
  linkDocument,
} from '../command';
import { findDocumentById, findDocumentsByEntity, findUnlinkedDocuments } from '../query';
import type { DocumentRow } from '../schema/types';

/**
 * Service dokumen — aturan akses file dan unggahan.
 *
 * Path storage tidak pernah keluar dari API: unduhan selalu lewat
 * presigned URL berumur pendek.
 */

const DOWNLOAD_TTL_SECONDS = 15 * 60;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** MIME yang boleh diunggah pemohon — pindaian dokumen, bukan berkas bebas. */
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

type PublicDocument = {
  id: number;
  original_filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  status: string;
  created_at: string;
};

const toPublic = (row: DocumentRow): PublicDocument => ({
  id: Number(row.id),
  original_filename: row.original_filename,
  mime_type: row.mime_type,
  size_bytes: row.size_bytes === null ? null : Number(row.size_bytes),
  status: row.status,
  created_at: String(row.created_at),
});

export const listByEntity = async (entityTable: string, entityId: number) => {
  const rows = await findDocumentsByEntity(entityTable, entityId);
  return rows.map(toPublic);
};

export const listUnlinked = async () => {
  const rows = await findUnlinkedDocuments();
  return rows.map(toPublic);
};

export const getDownloadUrl = async (id: number) => {
  const document = await findDocumentById(id);
  if (!document) throw notFound('Dokumen tidak ditemukan');
  if (document.status !== 'verified' && document.status !== 'stored') {
    throw notFound('Dokumen belum tersedia');
  }

  const { url, expiresAt } = await getStorage().presignGetObject(document.object_key);

  return {
    url,
    filename: document.original_filename,
    expires_at: expiresAt.toISOString(),
  };
};

/**
 * Unggah dokumen baru milik satu entitas (mis. lampiran permohonan cuti).
 *
 * Urutan: validasi berkas → tulis ke MinIO dengan kunci unik → catat baris
 * `documents` + `document_links`. Kalau pencatatan database gagal, objek yang
 * terlanjur terunggah dihapus lagi supaya tidak ada sampah di bucket.
 */
export const uploadDocument = async (input: {
  buffer: Buffer;
  filename: string;
  mimeType?: string | null;
  entityTable: string;
  entityId: number;
  field: string;
  label?: string | null;
  actorId: number;
}) => {
  const filename = input.filename?.trim();
  if (!filename) throw badRequest('Nama berkas wajib ada');
  if (input.buffer.length === 0) throw badRequest('Berkas kosong');
  if (input.buffer.length > MAX_UPLOAD_BYTES) {
    throw badRequest(
      `Ukuran berkas melebihi batas ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB`,
    );
  }

  const mime = (input.mimeType ?? '').toLowerCase() || null;
  if (mime && !ALLOWED_MIME.has(mime)) {
    throw badRequest('Jenis berkas tidak didukung (PDF, JPG, PNG, WEBP, atau HEIC)');
  }

  const sha256 = createHash('sha256').update(input.buffer).digest('hex');
  const ext = extname(filename).toLowerCase().replace(/^\./, '');
  const safeName = filename.replace(/[^\w.\-]+/g, '_').slice(0, 120);
  const objectKey = [
    'uploads',
    input.entityTable,
    input.entityId,
    `${Date.now()}-${sha256.slice(0, 12)}-${safeName || 'berkas'}`,
  ].join('/');

  const storage = getStorage();
  await storage.put({
    body: input.buffer,
    objectKey,
    contentType: mime ?? undefined,
    metadata: { uploadedBy: String(input.actorId) },
  });

  try {
    const documentId = await insertDocument({
      // `bucket` NOT NULL di tabel documents; unggahan aplikasi selalu ke bucket
      // yang dikonfigurasi. Tanpa ini setiap unggahan gagal 500
      // "Column 'bucket' cannot be null".
      bucket: config.storage.bucket,
      object_key: objectKey,
      original_filename: filename,
      mime_type: mime,
      extension: ext || null,
      size_bytes: input.buffer.length,
      sha256,
      status: 'stored',
    });

    await linkDocument({
      documentId,
      entityTable: input.entityTable,
      entityId: input.entityId,
      field: input.field,
      label: input.label ?? null,
    });

    return {
      id: documentId,
      object_key: objectKey,
      original_filename: filename,
      size_bytes: input.buffer.length,
      sha256,
    };
  } catch (error) {
    // Database gagal — jangan tinggalkan objek yatim di bucket.
    await storage.remove(objectKey).catch(() => undefined);
    throw error;
  }
};

/** Hapus dokumen (baris + objek). */
export const removeDocument = async (id: number) => {
  const document = await findDocumentById(id);
  if (!document) throw notFound('Dokumen tidak ditemukan');
  await getStorage().remove(document.object_key).catch(() => undefined);
  await deleteDocumentRow(id);
};

/** Dokumen hanya boleh dihapus pemiliknya atau admin. */
export const assertCanModify = (actor: { id: number; role: string }, ownerId: number) => {
  if (actor.role === 'admin') return;
  if (Number(actor.id) === Number(ownerId)) return;
  throw forbidden('Tidak berhak mengubah dokumen milik pegawai lain');
};