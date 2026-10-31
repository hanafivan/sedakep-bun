import { CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { config } from '../config';
import { logger } from './logger';
import type { StoragePort } from './storage';

/**
 * Memastikan bucket ada. Dipakai saat boot aplikasi dan sebelum migrasi.
 *
 * Catatan: hanya MinIO/S3 yang butuh ini. LocalStorage mengabaikannya.
 */
export const ensureBucket = async (
  storage: StoragePort,
  bucket: string = config.storage.bucket,
): Promise<void> => {
  if (config.storage.driver !== 'minio') return;

  const { s3ClientFor } = await import('./storage-client');
  const client = s3ClientFor();

  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    logger.info('storage:bucket', `bucket sudah ada: ${bucket}`);
    return;
  } catch {
    // belum ada -> buat
  }

  try {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
    logger.info('storage:bucket', `bucket dibuat: ${bucket}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Gagal membuat bucket ${bucket}: ${message}`);
  }
};

/** Health check storage — dipakai endpoint /health. */
export const storageHealthcheck = async (storage: StoragePort): Promise<boolean> => {
  try {
    await storage.head('__healthcheck__');
    return true;
  } catch {
    try {
      // head gagal karena belum ada = koneksi justru berhasil
      await storage.exists('__healthcheck__');
      return true;
    } catch {
      return false;
    }
  }
};
