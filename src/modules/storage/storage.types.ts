/**
 * Storage module types (S3).
 */

export interface S3UploadResult {
  key: string;
  url: string;
}

export interface StorageConfig {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
  publicUrlBase?: string;
}
