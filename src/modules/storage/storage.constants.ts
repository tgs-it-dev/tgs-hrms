/**
 * Storage module constants.
 * Config keys match env var names used with ConfigService.get().
 */

export const STORAGE_CONFIG_KEYS = {
  BUCKET: "AWS_S3_BUCKET",
  REGION: "AWS_S3_REGION",
  ACCESS_KEY_ID: "AWS_ACCESS_KEY_ID",
  SECRET_ACCESS_KEY: "AWS_SECRET_ACCESS_KEY",
  ENDPOINT: "AWS_S3_ENDPOINT",
  PUBLIC_URL_BASE: "AWS_S3_PUBLIC_URL_BASE",
} as const;

export const DEFAULT_S3_REGION = "us-east-1";
export const DEFAULT_SIGNED_URL_EXPIRES_IN = 3600; // 1 hour
export const DEFAULT_CONTENT_TYPE = "application/octet-stream";
export const INLINE_DISPOSITION = "inline";

/**
 * Response body field names that may contain S3 file URLs.
 * Signer replaces these with signed URLs so the frontend can load files (avoids 403).
 */
export const FILE_URL_FIELD_NAMES = [
  "profile_pic",
  "profile_picture",
  "logo_url",
  "cnic_picture",
  "cnic_back_picture",
  "cnicPicture",
  "cnicBackPicture",
  "proof_documents",
  "proofDocuments",
  "documents",
  "leave-documents",
] as const;

export type FileUrlFieldName = (typeof FILE_URL_FIELD_NAMES)[number];
