/**
 * File validation utility with magic number/file signature checks
 * Provides enhanced security beyond MIME type validation
 */

import { BadRequestException } from '@nestjs/common';

/**
 * File signatures (magic numbers) for common image formats
 * These are the first bytes of the file that identify the actual file type
 */
const FILE_SIGNATURES: Record<string, number[][]> = {
  'image/jpeg': [
    [0xff, 0xd8, 0xff], // JPEG standard
  ],
  'image/png': [
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], // PNG standard
  ],
  'image/gif': [
    [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], // GIF87a
    [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], // GIF89a
  ],
  'image/webp': [
    [0x52, 0x49, 0x46, 0x46], // RIFF header (WebP uses RIFF)
  ],
  'image/bmp': [
    [0x42, 0x4d], // BM
  ],
};

/**
 * Allowed MIME types for image uploads
 */
const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
];

/**
 * Allowed file extensions (JFIF is explicitly rejected - use JPG/JPEG instead)
 */
const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

/** Extensions that are not supported (e.g. .jfif often sent as image/jpeg) */
const REJECTED_IMAGE_EXTENSIONS = ['.jfif'];

/**
 * Maximum file size (5MB)
 */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Validates file signature (magic number) against expected MIME type
 */
function validateFileSignature(buffer: Buffer, expectedMimeType: string): boolean {
  const signatures = FILE_SIGNATURES[expectedMimeType.toLowerCase()];
  if (!signatures || signatures.length === 0) {
    // If no signature defined for this type, skip signature validation
    return true;
  }

  // Check if buffer starts with any of the expected signatures
  return signatures.some((signature) => {
    if (buffer.length < signature.length) {
      return false;
    }
    return signature.every((byte, index) => buffer[index] === byte);
  });
}

/**
 * Validates WebP files more thoroughly (RIFF + WEBP)
 */
function validateWebPSignature(buffer: Buffer): boolean {
  // WebP files start with RIFF header followed by WEBP
  if (buffer.length < 12) {
    return false;
  }

  const riffHeader = buffer.slice(0, 4);
  const webpHeader = buffer.slice(8, 12);

  const isRiff = riffHeader.equals(Buffer.from([0x52, 0x49, 0x46, 0x46]));
  const isWebp = webpHeader.equals(Buffer.from([0x57, 0x45, 0x42, 0x50]));

  return isRiff && isWebp;
}

/**
 * Comprehensive file validation for image uploads
 * Validates:
 * - File size
 * - File extension
 * - MIME type
 * - File signature (magic number)
 */
export function validateImageFile(
  file: Express.Multer.File | { buffer: Buffer; mimetype: string; originalname: string; size: number },
  options: {
    maxSize?: number;
    allowedMimeTypes?: string[];
    allowedExtensions?: string[];
  } = {}
): void {
  const maxSize = options.maxSize || MAX_FILE_SIZE;
  const allowedMimeTypes = options.allowedMimeTypes || ALLOWED_IMAGE_MIME_TYPES;
  const allowedExtensions = options.allowedExtensions || ALLOWED_IMAGE_EXTENSIONS;

  const fileExtension = file.originalname
    ? file.originalname.substring(file.originalname.lastIndexOf('.')).toLowerCase()
    : '';
  if (REJECTED_IMAGE_EXTENSIONS.includes(fileExtension)) {
    throw new BadRequestException(
      'JFIF image format is not supported. Please use JPG, JPEG, PNG, GIF, or WebP.',
    );
  }

  // Validate file size
  if (file.size > maxSize) {
    throw new BadRequestException(
      `File size exceeds maximum allowed size of ${maxSize / 1024 / 1024}MB`
    );
  }

  // Validate file extension (fileExtension already set above)
  if (!allowedExtensions.includes(fileExtension)) {
    throw new BadRequestException(
      `Invalid file extension. Allowed extensions: ${allowedExtensions.join(', ')}`
    );
  }

  // Validate MIME type
  const mimeType = file.mimetype.toLowerCase();
  if (!allowedMimeTypes.includes(mimeType)) {
    throw new BadRequestException(
      `Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`
    );
  }

  // Validate file signature (magic number) - most important security check
  // Skip this check if buffer is empty/undefined (allowing metadata-only validation in controller filter)
  if (!file.buffer || file.buffer.length === 0) {
    return;
  }

  // Special handling for WebP
  if (mimeType === 'image/webp') {
    if (!validateWebPSignature(file.buffer)) {
      throw new BadRequestException('Invalid WebP file signature');
    }
  } else {
    // Validate signature for other image types
    if (!validateFileSignature(file.buffer, mimeType)) {
      throw new BadRequestException(
        `File signature does not match declared MIME type: ${mimeType}`
      );
    }
  }
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  return filename.substring(filename.lastIndexOf('.')).toLowerCase();
}

/**
 * Check if file extension is allowed
 */
export function isAllowedExtension(
  filename: string,
  allowedExtensions: string[]
): boolean {
  const ext = getFileExtension(filename);
  return allowedExtensions.includes(ext);
}
