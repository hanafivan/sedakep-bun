import {
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { createReadStream, readFileSync, statSync } from 'node:fs';
import { readFile, stat, mkdir, writeFile, unlink, access } from 'node:fs/promises';
import { dirname, join, normalize, resolve } from 'node:path';
import type { Readable } from 'node:stream';
import { config } from '../config';
import { logger } from './logger';
import { s3ClientFor } from './storage-client';

/** Di bawah ambang ini file dibaca ke Buffer, di atasnya pakai stream. */
const STREAM_THRESHOLD_BYTES = 8 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UploadInput {
  /** Buffer atau path ke file lokal. */
  body: Buffer | Readable | string;
  objectKey: string;
  contentType?: string;
  /** Metadata bebas (string-only values). */
  metadata?: Record<string, string>;
}

export interface UploadResult {
  objectKey: string;
  bucket: string;
  etag: string;
  versionId?: string;
  sizeBytes?: number;
}

export interface ObjectMeta {
  objectKey: string;
  bucket: string;
  sizeBytes: number;
  etag: string;
  contentType: string;
  lastModified: Date;
  metadata?: Record<string, string>;
}

export interface PresignedResult {
  url: string;
  expiresAt: Date;
}

// ---------------------------------------------------------------------------
// Storage interface — MinIO adapter + local fallback implementasi ini
// ---------------------------------------------------------------------------

export interface StoragePort {
  put(input: UploadInput): Promise<UploadResult>;
  get(objectKey: string): Promise<Readable | null>;
  head(objectKey: string): Promise<ObjectMeta | null>;
  remove(objectKey: string): Promise<void>;
  exists(objectKey: string): Promise<boolean>;
  presignGetObject(objectKey: string): Promise<PresignedResult>;
  /** Khusus upload dari path file lokal — pakai stream, hemat memory. */
  putFromFile(filePath: string, objectKey: string, contentType?: string): Promise<UploadResult>;
}

// ---------------------------------------------------------------------------
// MinIO / S3 adapter
// ---------------------------------------------------------------------------

export class MinioStorage implements StoragePort {
  private readonly bucket: string;

  constructor(bucket?: string) {
    this.bucket = bucket ?? config.storage.bucket;
  }

  async put(input: UploadInput): Promise<UploadResult> {
    const body = typeof input.body === 'string' ? createReadStream(input.body) : input.body;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: input.objectKey,
      Body: body,
      ContentType: input.contentType,
      Metadata: input.metadata,
    });
    const res = await s3ClientFor().send(command);
    logger.info('storage:put', `${this.bucket}/${input.objectKey}`, {
      etag: res.ETag,
    });
    return {
      objectKey: input.objectKey,
      bucket: this.bucket,
      etag: res.ETag ?? '',
      versionId: res.VersionId,
    };
  }

  /**
   * Upload dari path lokal.
   *
   * File kecil/medium dibaca ke Buffer: runtime fetch tidak selalu akurat soal
   * panjang stream, dan `ContentLength` yang tidak cocok membuat MinIO menolak
   * dengan "did not provide the number of bytes specified by Content-Length".
   * Di atas ambang itu baru pakai stream supaya memory tetap aman.
   */
  async putFromFile(filePath: string, objectKey: string, contentType?: string): Promise<UploadResult> {
    const info = statSync(filePath);
    const useBuffer = info.size <= STREAM_THRESHOLD_BYTES;
    const body = useBuffer ? readFileSync(filePath) : createReadStream(filePath);
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
      Body: body,
      ContentType: contentType ?? guessContentType(filePath),
      ...(useBuffer ? {} : { ContentLength: info.size }),
    });
    const res = await s3ClientFor().send(command);
    logger.info('storage:putFromFile', `${this.bucket}/${objectKey}`, {
      size: info.size,
      etag: res.ETag,
    });
    return {
      objectKey,
      bucket: this.bucket,
      etag: res.ETag ?? '',
      versionId: res.VersionId,
      sizeBytes: info.size,
    };
  }

  async get(objectKey: string): Promise<Readable | null> {
    try {
      const command = new GetObjectCommand({ Bucket: this.bucket, Key: objectKey });
      const res = await s3ClientFor().send(command);
      return res.Body as Readable;
    } catch (error: unknown) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async head(objectKey: string): Promise<ObjectMeta | null> {
    try {
      const command = new HeadObjectCommand({ Bucket: this.bucket, Key: objectKey });
      const res = await s3ClientFor().send(command);
      return {
        objectKey,
        bucket: this.bucket,
        sizeBytes: res.ContentLength ?? 0,
        etag: res.ETag ?? '',
        contentType: res.ContentType ?? 'application/octet-stream',
        lastModified: res.LastModified ?? new Date(),
        metadata: res.Metadata,
      };
    } catch (error: unknown) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async remove(objectKey: string): Promise<void> {
    await s3ClientFor().send(new DeleteObjectCommand({ Bucket: this.bucket, Key: objectKey }));
    logger.info('storage:remove', `${this.bucket}/${objectKey}`);
  }

  async exists(objectKey: string): Promise<boolean> {
    return (await this.head(objectKey)) !== null;
  }

  async presignGetObject(objectKey: string): Promise<PresignedResult> {
    // Dynamic import supaya tidak wajib memasukkan presigner ke bundle bila tidak dipakai.
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: objectKey });
    const url = await getSignedUrl(s3ClientFor(), command, {
      expiresIn: config.storage.presignTtlSeconds,
    });
    return { url, expiresAt: new Date(Date.now() + config.storage.presignTtlSeconds * 1000) };
  }
}

// ---------------------------------------------------------------------------
// Local filesystem adapter — fallback / development
// ---------------------------------------------------------------------------

export class LocalStorage implements StoragePort {
  private readonly root: string;

  constructor(root?: string) {
    this.root = resolve(root ?? config.storage.localRoot);
  }

  private abs(objectKey: string): string {
    // Prevent directory traversal
    const full = normalize(join(this.root, objectKey));
    if (!full.startsWith(this.root)) {
      throw new Error('Path traversal ditolak');
    }
    return full;
  }

  async put(input: UploadInput): Promise<UploadResult> {
    const filePath = this.abs(input.objectKey);
    await mkdir(dirname(filePath), { recursive: true });

    if (Buffer.isBuffer(input.body)) {
      await writeFile(filePath, input.body);
    } else if (typeof input.body === 'string') {
      // treat as source file path — copy
      const data = await readFile(input.body);
      await writeFile(filePath, data);
    } else {
      // Readable stream
      const { pipeline } = await import('node:stream/promises');
      const { createWriteStream } = await import('node:fs');
      await pipeline(input.body, createWriteStream(filePath));
    }

    const info = await stat(filePath);
    logger.info('local:put', input.objectKey, { size: info.size });
    return {
      objectKey: input.objectKey,
      bucket: 'local',
      etag: `"${info.size}-${info.mtimeMs}"`,
      sizeBytes: info.size,
    };
  }

  async putFromFile(filePath: string, objectKey: string, _contentType?: string): Promise<UploadResult> {
    const src = await readFile(filePath);
    const dest = this.abs(objectKey);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, src);
    const info = await stat(dest);
    return {
      objectKey,
      bucket: 'local',
      etag: `"${info.size}-${info.mtimeMs}"`,
      sizeBytes: info.size,
    };
  }

  async get(objectKey: string): Promise<Readable | null> {
    try {
      await access(this.abs(objectKey));
      const { createReadStream } = await import('node:fs');
      return createReadStream(this.abs(objectKey));
    } catch {
      return null;
    }
  }

  async head(objectKey: string): Promise<ObjectMeta | null> {
    try {
      const info = await stat(this.abs(objectKey));
      return {
        objectKey,
        bucket: 'local',
        sizeBytes: info.size,
        etag: `"${info.size}-${info.mtimeMs}"`,
        contentType: guessContentType(objectKey),
        lastModified: info.mtime,
      };
    } catch {
      return null;
    }
  }

  async remove(objectKey: string): Promise<void> {
    try {
      await unlink(this.abs(objectKey));
    } catch {
      // ignore if already gone
    }
  }

  async exists(objectKey: string): Promise<boolean> {
    try {
      await stat(this.abs(objectKey));
      return true;
    } catch {
      return false;
    }
  }

  async presignGetObject(objectKey: string): Promise<PresignedResult> {
    // Tidak relevan untuk local — caller harus streaming langsung.
    return { url: `/api/v1/files/${objectKey}`, expiresAt: new Date(Date.now() + 3600_000) };
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export const createStorage = (driver?: string): StoragePort => {
  const d = driver ?? config.storage.driver;
  if (d === 'local') return new LocalStorage();
  return new MinioStorage();
};

let storage: StoragePort | undefined;

export const getStorage = (): StoragePort => {
  if (!storage) storage = createStorage();
  return storage;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isNotFound(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as Record<string, unknown>;
  const name = String(err.name ?? err.$metadata ?? '');
  const status = Number((err.$metadata as Record<string, unknown>)?.httpStatusCode ?? 0);
  return name.includes('NotFound') || name.includes('NoSuchKey') || status === 404;
}

function guessContentType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    txt: 'text/plain',
    html: 'text/html',
    json: 'application/json',
  };
  return map[ext] ?? 'application/octet-stream';
}