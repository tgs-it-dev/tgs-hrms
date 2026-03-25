import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { validateImageFile } from '../../../common/utils/file-validation.util';
import { S3StorageService } from "../../storage/storage.service";

const PREFIX_LEAVE = 'leave-documents';

@Injectable()
export class LeaveFileUploadService {
  constructor(private readonly s3: S3StorageService) {}

  /** employeeId = user id of the employee who applied for leave */
  async uploadLeaveDocument(
    file: Express.Multer.File,
    leaveId: string,
    employeeId: string,
  ): Promise<string> {
    validateImageFile(file);
    const ext = path.extname(file.originalname);
    const fileName = `${leaveId}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    const key = `${PREFIX_LEAVE}/${employeeId}/${fileName}`;

    if (this.s3.isEnabled()) {
      const result = await this.s3.upload(file.buffer, key, file.mimetype);
      return result.url;
    }

    const uploadDir = path.join(
      process.cwd(),
      "public",
      PREFIX_LEAVE,
      employeeId,
    );
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    fs.writeFileSync(path.join(uploadDir, fileName), file.buffer);
    return `/${PREFIX_LEAVE}/${employeeId}/${fileName}`;
  }

  async uploadLeaveDocuments(
    files: Express.Multer.File[],
    leaveId: string,
    employeeId: string,
  ): Promise<string[]> {
    const uploadPromises = files.map((file) =>
      this.uploadLeaveDocument(file, leaveId, employeeId),
    );
    return Promise.all(uploadPromises);
  }

  private localPathFromStoredUrl(prefix: string, storedUrl: string): string {
    const relative = storedUrl.replace(/^\/+/, "").split("?")[0];
    if (!relative || !relative.startsWith(prefix + "/"))
      return path.join(process.cwd(), "public", prefix, relative || "");
    return path.join(process.cwd(), "public", relative);
  }

  async deleteLeaveDocument(documentUrl: string): Promise<void> {
    if (!documentUrl) return;

    if (this.s3.isEnabled() && this.s3.isS3Url(documentUrl)) {
      await this.s3.deleteByUrl(documentUrl);
      return;
    }

    const filePath = this.localPathFromStoredUrl(PREFIX_LEAVE, documentUrl);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  async deleteLeaveDocuments(documentUrls: string[]): Promise<void> {
    if (!documentUrls || documentUrls.length === 0) return;
    const deletePromises = documentUrls.map((url) =>
      this.deleteLeaveDocument(url),
    );
    await Promise.all(deletePromises);
  }
}
