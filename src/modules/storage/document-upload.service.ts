import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { validateImageFile } from '../../common/utils/file-validation.util';
import { S3StorageService } from './storage.service';

@Injectable()
export class DocumentUploadService {
  constructor(private readonly s3: S3StorageService) {}

  async uploadDocument(
    file: Express.Multer.File,
    prefix: string,
    entityId: string,
    employeeId: string,
  ): Promise<string> {
    validateImageFile(file);
    const ext = path.extname(file.originalname);
    const fileName = `${entityId}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    const key = `${prefix}/${employeeId}/${fileName}`;

    if (this.s3.isEnabled()) {
      const result = await this.s3.upload(file.buffer, key, file.mimetype);
      return result.url;
    }

    const uploadDir = path.join(process.cwd(), 'public', prefix, employeeId);
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    fs.writeFileSync(path.join(uploadDir, fileName), file.buffer);
    return `/${prefix}/${employeeId}/${fileName}`;
  }

  async uploadDocuments(
    files: Express.Multer.File[],
    prefix: string,
    entityId: string,
    employeeId: string,
  ): Promise<string[]> {
    return Promise.all(
      files.map((file) =>
        this.uploadDocument(file, prefix, entityId, employeeId),
      ),
    );
  }

  async deleteDocument(documentUrl: string): Promise<void> {
    if (!documentUrl) return;

    if (this.s3.isEnabled() && this.s3.isS3Url(documentUrl)) {
      await this.s3.deleteByUrl(documentUrl);
      return;
    }

    const relative = documentUrl.replace(/^\/+/, '').split('?')[0];
    const filePath = path.join(process.cwd(), 'public', relative);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  async deleteDocuments(documentUrls: string[]): Promise<void> {
    if (!documentUrls?.length) return;
    await Promise.all(documentUrls.map((url) => this.deleteDocument(url)));
  }

  sameObject(urlOrPathA: string, urlOrPathB: string): boolean {
    return this.s3.sameObject(urlOrPathA, urlOrPathB);
  }
}
