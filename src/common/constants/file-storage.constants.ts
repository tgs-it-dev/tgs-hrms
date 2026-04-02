

export const FILE_STORAGE_PUBLIC_DIR = 'public';


export const FILE_STORAGE_CACHE_CONTROL = 'public, max-age=31536000';


export const EMPLOYEE_FILE_BUCKETS = {
  PROFILE_PICTURES: 'profile-pictures',
  CNIC_PICTURES: 'cnic-pictures',
  CNIC_BACK_PICTURES: 'cnic-back-pictures',
} as const;


export const FILE_STORAGE_CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
};
