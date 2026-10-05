import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { join, resolve } from 'path';

/**
 * Where uploaded files live. The rest of the code only depends on this abstract
 * class, so moving to S3 / GCS / Cloudinary means adding one implementation and
 * changing the provider in StorageModule.
 */
export abstract class StorageService {
  /** Stores the bytes under `key` (e.g. "products/ab12.jpg") and returns a public URL. */
  abstract put(key: string, data: Buffer, contentType: string): Promise<string>;
  abstract remove(url: string): Promise<void>;
}

@Injectable()
export class LocalDiskStorage extends StorageService {
  private readonly root: string;
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    super();
    this.root = resolve(config.get<string>('uploadDir')!);
    this.baseUrl = `${config.get<string>('publicBaseUrl')}/uploads`;
  }

  async put(key: string, data: Buffer): Promise<string> {
    const safeKey = key.replace(/\.\./g, '').replace(/^\/+/, '');
    const path = join(this.root, safeKey);
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, data);
    return `${this.baseUrl}/${safeKey}`;
  }

  async remove(url: string): Promise<void> {
    if (!url.startsWith(this.baseUrl)) return; // external URL (e.g. seeded demo images)
    const key = url.slice(this.baseUrl.length + 1).replace(/\.\./g, '');
    await unlink(join(this.root, key)).catch(() => undefined);
  }
}

/** S3-compatible object storage (AWS S3, Cloudflare R2, Backblaze B2, MinIO). */
@Injectable()
export class S3Storage extends StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(config: ConfigService) {
    super();
    const env = process.env;
    this.bucket = env.S3_BUCKET!;
    this.publicUrl = (env.S3_PUBLIC_URL ?? '').replace(/\/$/, '');
    this.client = new S3Client({
      region: env.S3_REGION || 'auto',
      endpoint: env.S3_ENDPOINT || undefined,
      credentials: { accessKeyId: env.S3_ACCESS_KEY_ID!, secretAccessKey: env.S3_SECRET_ACCESS_KEY! },
    });
    void config;
  }

  async put(key: string, data: Buffer, contentType: string): Promise<string> {
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket, Key: key, Body: data, ContentType: contentType, CacheControl: 'public, max-age=2592000',
    }));
    return `${this.publicUrl}/${key}`;
  }

  async remove(url: string): Promise<void> {
    if (!url.startsWith(this.publicUrl + '/')) return;
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: url.slice(this.publicUrl.length + 1) })).catch(() => undefined);
  }
}
