import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { Response } from 'express';
import { validateImageFile } from '../utils/file-validation.util';
import {
  FILE_STORAGE_CACHE_CONTROL,
  FILE_STORAGE_CONTENT_TYPES,
  FILE_STORAGE_PUBLIC_DIR,
} from '../constants/file-storage.constants';

@Injectable()
export class FileStorageService {
  saveImageFile(file: Express.Multer.File, bucket: string, entityId: string): string {
    validateImageFile(file);
    const uploadDir = path.join(process.cwd(), FILE_STORAGE_PUBLIC_DIR, bucket);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const fileExtension = path.extname(file.originalname);
    const fileName = `${entityId}-${Date.now()}${fileExtension}`;
    const filePath = path.join(uploadDir, fileName);
    fs.writeFileSync(filePath, file.buffer);
    return `/${bucket}/${fileName}`;
  }

  deleteByUrl(fileUrl: string, bucket: string): void {
    if (!fileUrl) return;
    const fileName = this.extractFileName(fileUrl);
    if (!fileName) return;
    const filePath = this.buildAbsolutePath(bucket, fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  extractFileName(fileUrl: string): string | null {
    const fileName = fileUrl.split('/').pop();
    return fileName || null;
  }

  buildAbsolutePath(bucket: string, fileName: string): string {
    return path.join(process.cwd(), FILE_STORAGE_PUBLIC_DIR, bucket, fileName);
  }

  exists(absolutePath: string): boolean {
    return fs.existsSync(absolutePath);
  }

  streamFileInline(res: Response, absolutePath: string, fileName: string): void {
    const ext = path.extname(fileName).toLowerCase();
    const contentType = FILE_STORAGE_CONTENT_TYPES[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.setHeader('Cache-Control', FILE_STORAGE_CACHE_CONTROL);
    fs.createReadStream(absolutePath).pipe(res);
  }
}
