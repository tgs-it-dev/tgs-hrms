import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { validateImageFile } from '../../../common/utils/file-validation.util';
import { S3StorageService } from "../../storage/storage.service";

const PREFIX_REIMBURSEMENT = 'reimbursement-documents';

@Injectable()
export class ReimbursementFileUploadService {
  constructor(private readonly s3: S3StorageService) {}

  async uploadReimbursementDocument(
    file: Express.Multer.File,
    requestId: string,
  ): Promise<string> {
    validateImageFile(file);
    const ext = path.extname(file.originalname);
    const fileName = `${requestId}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    const key = `${PREFIX_REIMBURSEMENT}/${fileName}`;

    if (this.s3.isEnabled()) {
      const result = await this.s3.upload(file.buffer, key, file.mimetype);
      return result.url;
    }

    const uploadDir = path.join(process.cwd(), 'public', PREFIX_REIMBURSEMENT);
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, fileName);
    fs.writeFileSync(filePath, file.buffer);
    return `/${PREFIX_REIMBURSEMENT}/${fileName}`;
  }

  async uploadReimbursementDocuments(
    files: Express.Multer.File[],
    requestId: string,
  ): Promise<string[]> {
    const uploadPromises = files.map((file) =>
      this.uploadReimbursementDocument(file, requestId),
    );
    return Promise.all(uploadPromises);
  }

  async deleteReimbursementDocument(documentPath: string): Promise<void> {
    if (!documentPath) return;

    if (this.s3.isEnabled() && this.s3.isS3Url(documentPath)) {
      await this.s3.deleteByUrl(documentPath);
      return;
    }

    const fileName = documentPath.split('/').pop();
    if (!fileName) return;
    const filePath = path.join(process.cwd(), 'public', PREFIX_REIMBURSEMENT, fileName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  async deleteReimbursementDocuments(documentPaths: string[]): Promise<void> {
    const deletePromises = documentPaths.map((docPath) =>
      this.deleteReimbursementDocument(docPath),
    );
    await Promise.all(deletePromises);
  }
}
