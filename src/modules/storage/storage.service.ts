import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  STORAGE_CONFIG_KEYS,
  DEFAULT_S3_REGION,
  DEFAULT_SIGNED_URL_EXPIRES_IN,
  DEFAULT_CONTENT_TYPE,
  INLINE_DISPOSITION,
} from "./storage.constants";
import type { S3UploadResult } from "./storage.types";

/** Single S3 provider; inject as S3StorageService for backward compatibility. */
@Injectable()
export class S3StorageService {
  private readonly client: S3Client | null = null;
  private readonly bucket: string;
  private readonly region: string;
  private readonly publicUrlBase: string | undefined;
  readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.get<string>(STORAGE_CONFIG_KEYS.BUCKET) ?? "";
    this.region =
      this.config.get<string>(STORAGE_CONFIG_KEYS.REGION) ?? DEFAULT_S3_REGION;
    this.publicUrlBase = this.config.get<string>(
      STORAGE_CONFIG_KEYS.PUBLIC_URL_BASE,
    );
    const accessKeyId = this.config.get<string>(
      STORAGE_CONFIG_KEYS.ACCESS_KEY_ID,
    );
    const secretAccessKey = this.config.get<string>(
      STORAGE_CONFIG_KEYS.SECRET_ACCESS_KEY,
    );
    const endpoint = this.config.get<string>(STORAGE_CONFIG_KEYS.ENDPOINT);

    this.enabled = Boolean(this.bucket && accessKeyId && secretAccessKey);

    if (this.enabled && accessKeyId && secretAccessKey) {
      this.client = new S3Client({
        region: this.region,
        credentials: { accessKeyId, secretAccessKey },
        ...(endpoint && { endpoint, forcePathStyle: true }),
      });
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async upload(
    buffer: Buffer,
    key: string,
    contentType?: string,
  ): Promise<S3UploadResult> {
    if (!this.enabled || !this.client) {
      throw new Error(
        "S3 is not configured. Set AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY.",
      );
    }
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType ?? DEFAULT_CONTENT_TYPE,
      }),
    );
    return { key, url: this.getPublicUrl(key) };
  }

  async deleteByKey(key: string): Promise<void> {
    if (!this.enabled || !this.client || !key) return;
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  async deleteByUrl(url: string): Promise<void> {
    if (!url || !this.enabled || !this.client) return;
    const key = this.urlToKey(url) ?? this.getKeyFromUrlOrPath(url);
    if (key) await this.deleteByKey(key);
  }

  getPublicUrl(key: string): string {
    if (this.publicUrlBase) {
      const base = this.publicUrlBase.replace(/\/$/, "");
      return `${base}/${key}`;
    }
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  /**
   * Extract S3 key from a full URL (stored or signed; query string is ignored).
   */
  urlToKey(url: string): string | null {
    try {
      if (this.publicUrlBase) {
        const base = this.publicUrlBase.replace(/\/$/, "");
        if (url.startsWith(base + "/") || url === base) {
          const key = url.slice(base.length).replace(/^\/+/, "").split("?")[0];
          return key || null;
        }
      }
      const u = new URL(url);
      const pathname = u.pathname.replace(/^\/+/, "");
      if (!pathname) return null;
      if (
        u.hostname.includes(".s3.") &&
        u.hostname.endsWith(".amazonaws.com")
      ) {
        return pathname;
      }
      if (pathname.startsWith(this.bucket + "/")) {
        return pathname.slice(this.bucket.length + 1);
      }
      return pathname;
    } catch {
      return null;
    }
  }

  /**
   * Normalize stored URL, signed URL, or path-style value to S3 key for matching and delete.
   * Use when comparing frontend-supplied URL (signed) with DB-stored URL.
   */
  getKeyFromUrlOrPath(urlOrPath: string): string | null {
    if (!urlOrPath || typeof urlOrPath !== "string") return null;
    const key = this.urlToKey(urlOrPath);
    if (key) return key;
    const pathStyle = urlOrPath.replace(/^\/+/, "").split("?")[0].trim();
    return pathStyle || null;
  }

  /**
   * Return true if two URLs or paths refer to the same S3 object (for matching frontend signed URL to stored URL).
   */
  sameObject(urlOrPathA: string, urlOrPathB: string): boolean {
    const keyA = this.getKeyFromUrlOrPath(urlOrPathA);
    const keyB = this.getKeyFromUrlOrPath(urlOrPathB);
    if (!keyA || !keyB) return urlOrPathA === urlOrPathB;
    return keyA === keyB;
  }

  isS3Url(url: string): boolean {
    return this.urlToKey(url) !== null;
  }

  async getObjectStream(key: string): Promise<NodeJS.ReadableStream | null> {
    if (!this.enabled || !this.client) return null;
    try {
      const res = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return (res.Body ?? null) as NodeJS.ReadableStream | null;
    } catch {
      return null;
    }
  }

  async getSignedGetUrl(
    key: string,
    expiresInSeconds = DEFAULT_SIGNED_URL_EXPIRES_IN,
  ): Promise<string> {
    if (!this.enabled || !this.client) {
      throw new Error("S3 is not configured.");
    }
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentDisposition: INLINE_DISPOSITION,
    });
    return getSignedUrl(this.client, command, {
      expiresIn: expiresInSeconds,
    });
  }

  /**
   * Returns a signed GET URL for a stored value (full S3 URL only).
   * Path-style values are returned unchanged to avoid NoSuchKey for legacy local files.
   */
  async getSignedUrlForStoredValue(
    storedValue: string,
    expiresInSeconds = DEFAULT_SIGNED_URL_EXPIRES_IN,
  ): Promise<string> {
    if (
      !storedValue ||
      typeof storedValue !== "string" ||
      !this.enabled ||
      !this.client ||
      !this.isS3Url(storedValue)
    ) {
      return storedValue;
    }
    const key = this.urlToKey(storedValue);
    if (!key) return storedValue;
    try {
      return await this.getSignedGetUrl(key, expiresInSeconds);
    } catch {
      return storedValue;
    }
  }
}
