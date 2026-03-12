import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { validateImageFile } from '../../../common/utils/file-validation.util';
import { S3StorageService } from "../../storage/storage.service";

const PREFIX_LEAVE = 'leave-documents';

@Injectable()
export class LeaveFileUploadService {
  constructor(private readonly s3: S3StorageService) {}

  async uploadLeaveDocument(file: Express.Multer.File, leaveId: string): Promise<string> {
    validateImageFile(file);
    const ext = path.extname(file.originalname);
    const fileName = `${leaveId}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    const key = `${PREFIX_LEAVE}/${fileName}`;

    if (this.s3.isEnabled()) {
      const result = await this.s3.upload(file.buffer, key, file.mimetype);
      return result.url;
    }

    const uploadDir = path.join(process.cwd(), 'public', PREFIX_LEAVE);
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, fileName);
    fs.writeFileSync(filePath, file.buffer);
    return `/${PREFIX_LEAVE}/${fileName}`;
  }

  async uploadLeaveDocuments(files: Express.Multer.File[], leaveId: string): Promise<string[]> {
    const uploadPromises = files.map((file) => this.uploadLeaveDocument(file, leaveId));
    return Promise.all(uploadPromises);
  }

  async deleteLeaveDocument(documentUrl: string): Promise<void> {
    if (!documentUrl) return;

    if (this.s3.isEnabled() && this.s3.isS3Url(documentUrl)) {
      await this.s3.deleteByUrl(documentUrl);
      return;
    }

    const fileName = documentUrl.split('/').pop();
    if (!fileName) return;
    const filePath = path.join(process.cwd(), 'public', PREFIX_LEAVE, fileName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  async deleteLeaveDocuments(documentUrls: string[]): Promise<void> {
    if (!documentUrls || documentUrls.length === 0) return;
    const deletePromises = documentUrls.map((url) => this.deleteLeaveDocument(url));
    await Promise.all(deletePromises);
  }
}
