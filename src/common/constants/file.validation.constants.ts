export const FILE_ERROR = {
  INVALID_TYPE: 'Invalid file type. Only image files are allowed (JPG, JPEG, PNG, GIF, WebP)',
  SIZE_EXCEEDED: 'File size exceeds the maximum allowed limit of 5MB',
  FAILED_VALIDATION: 'File validation failed. Please upload a valid image file',
  UPLOAD_FAILED: 'File upload failed',
  ERROR_OCCURRED: 'An error occurred during file upload',
  UPLOAD_ERROR_DEFAULT: 'File upload error',
  INVALID_WEBP_SIGNATURE: 'Invalid WebP file signature',
  SIGNATURE_MISMATCH: 'File signature does not match declared MIME type',
} as const;
