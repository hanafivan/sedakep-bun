import { S3Client } from '@aws-sdk/client-s3';
import { config } from '../config';

/**
 * Satu instance S3Client untuk seluruh aplikasi.
 * Dipisah dari storage.ts supaya modul lain (mis. ensureBucket) bisa memakai
 * koneksi yang sama tanpa mengekspor internal adapter.
 */
let client: S3Client | undefined;

export const s3ClientFor = (): S3Client => {
  if (!client) {
    client = new S3Client({
      region: config.storage.region,
      endpoint: config.storage.endpoint,
      forcePathStyle: config.storage.forcePathStyle,
      credentials: {
        accessKeyId: config.storage.accessKey,
        secretAccessKey: config.storage.secretKey,
      },
    });
  }
  return client;
};

export const closeS3 = (): void => {
  client?.destroy();
  client = undefined;
};
