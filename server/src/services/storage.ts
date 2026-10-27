import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import { Readable } from 'stream';

const S3_BUCKET = process.env.S3_BUCKET || process.env.R2_BUCKET;
const S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID;
const S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY;
const S3_ENDPOINT = process.env.S3_ENDPOINT || process.env.R2_ENDPOINT || process.env.CLOUDFLARE_R2_ENDPOINT;
const S3_REGION = process.env.S3_REGION || process.env.R2_REGION || 'auto';
const S3_PUBLIC_URL = process.env.S3_PUBLIC_URL || process.env.R2_PUBLIC_URL;

export const isCloudStorageConfigured = Boolean(
  S3_BUCKET && S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY
);

let s3Client: S3Client | null = null;
if (isCloudStorageConfigured) {
  s3Client = new S3Client({
    region: S3_REGION,
    endpoint: S3_ENDPOINT,
    credentials: {
      accessKeyId: S3_ACCESS_KEY_ID!,
      secretAccessKey: S3_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: Boolean(
      S3_ENDPOINT &&
      !S3_ENDPOINT.includes('amazonaws.com') &&
      !S3_ENDPOINT.includes('r2.cloudflarestorage.com')
    ),
  });
}

/**
 * Upload a local file to S3/R2 bucket in the background
 */
export async function uploadToStorage(
  localFilePath: string,
  storageKey: string,
  contentType?: string
): Promise<string | null> {
  if (!s3Client || !S3_BUCKET) return null;

  try {
    const fileStream = fs.createReadStream(localFilePath);
    const stats = fs.statSync(localFilePath);

    await s3Client.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: storageKey,
        Body: fileStream,
        ContentLength: stats.size,
        ContentType: contentType || 'application/octet-stream',
      })
    );

    if (S3_PUBLIC_URL) {
      const cleanBase = S3_PUBLIC_URL.replace(/\/+$/, '');
      const cleanKey = storageKey.startsWith('/') ? storageKey.slice(1) : storageKey;
      return `${cleanBase}/${cleanKey}`;
    }

    return storageKey;
  } catch (err) {
    console.warn(`[storage] Failed to upload ${storageKey} to object storage:`, err);
    return null;
  }
}

/**
 * Retrieve an object from S3/R2 storage (used when local disk was wiped on Render restart)
 */
export async function getFromStorage(
  storageKey: string
): Promise<{ stream: Readable; contentType?: string; contentLength?: number } | null> {
  if (!s3Client || !S3_BUCKET) return null;

  try {
    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: storageKey,
      })
    );

    if (response.Body) {
      return {
        stream: response.Body as Readable,
        contentType: response.ContentType,
        contentLength: response.ContentLength,
      };
    }
  } catch {
    // Not found in storage
  }

  return null;
}
