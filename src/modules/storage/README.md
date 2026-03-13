# Storage Module (S3)

Single NestJS module for S3 file storage: upload, delete, signed URLs, and response-body URL signing.

## Structure

- `storage.module.ts` – Global module; registers `S3StorageService` and `FileUrlSignerService`.
- `storage.service.ts` – Single S3 client and all S3 operations (upload, delete, getPublicUrl, getSignedUrlForStoredValue, etc.).
- `storage.constants.ts` – Env key names, default expiry, content disposition, and file-URL field names for the signer.
- `storage.types.ts` – `S3UploadResult`, `StorageConfig`.
- `file-url-signer.service.ts` – Walks API response bodies and replaces known file URL fields with signed URLs.
- `signed-file-url.interceptor.ts` – Global interceptor that runs the signer on every response.

## Configuration

All configuration is read via `ConfigService` (no hardcoded credentials or bucket). Required env vars:

- `AWS_S3_BUCKET`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

Optional: `AWS_S3_REGION`, `AWS_S3_ENDPOINT`, `AWS_S3_PUBLIC_URL_BASE`.

## Usage

Inject `S3StorageService` where you need upload/delete/sign. Use `storage.isEnabled()` before calling S3; when disabled, feature modules fall back to local disk.
