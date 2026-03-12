import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { validateImageFile } from '../../../common/utils/file-validation.util';
import { S3StorageService } from "../../storage/storage.service";

const PREFIX_REIMBURSEMENT = 'reimbursement-documents';

@Injectable()
export class ReimbursementFileUploadService {
  constructor(private readonly s3: S3StorageService) {}

  /** employeeId = Employee entity id (owner of the request) */
  async uploadReimbursementDocument(
    file: Express.Multer.File,
    requestId: string,
    employeeId: string,
  ): Promise<string> {
    validateImageFile(file);
    const ext = path.extname(file.originalname);
    const fileName = `${requestId}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    const key = `${PREFIX_REIMBURSEMENT}/${employeeId}/${fileName}`;

    if (this.s3.isEnabled()) {
      const result = await this.s3.upload(file.buffer, key, file.mimetype);
      return result.url;
    }

    const uploadDir = path.join(
      process.cwd(),
      "public",
      PREFIX_REIMBURSEMENT,
      employeeId,
    );
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    fs.writeFileSync(path.join(uploadDir, fileName), file.buffer);
    return `/${PREFIX_REIMBURSEMENT}/${employeeId}/${fileName}`;
  }

  async uploadReimbursementDocuments(
    files: Express.Multer.File[],
    requestId: string,
    employeeId: string,
  ): Promise<string[]> {
    const uploadPromises = files.map((file) =>
      this.uploadReimbursementDocument(file, requestId, employeeId),
    );
    return Promise.all(uploadPromises);
  }

  private localPathFromStoredUrl(prefix: string, storedUrl: string): string {
    const relative = storedUrl.replace(/^\/+/, "").split("?")[0];
    if (!relative || !relative.startsWith(prefix + "/"))
      return path.join(process.cwd(), "public", prefix, relative || "");
    return path.join(process.cwd(), "public", relative);
  }

  async deleteReimbursementDocument(documentPath: string): Promise<void> {
    if (!documentPath) return;

    if (this.s3.isEnabled() && this.s3.isS3Url(documentPath)) {
      await this.s3.deleteByUrl(documentPath);
      return;
    }

    const filePath = this.localPathFromStoredUrl(
      PREFIX_REIMBURSEMENT,
      documentPath,
    );
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  async deleteReimbursementDocuments(documentPaths: string[]): Promise<void> {
    const deletePromises = documentPaths.map((docPath) =>
      this.deleteReimbursementDocument(docPath),
    );
    await Promise.all(deletePromises);
  }
}
