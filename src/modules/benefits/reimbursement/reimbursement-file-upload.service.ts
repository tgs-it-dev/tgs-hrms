import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { validateImageFile } from '../../../common/utils/file-validation.util';

@Injectable()
export class ReimbursementFileUploadService {
  /**
   * Upload a single proof document for reimbursement request
   */
  async uploadReimbursementDocument(
    file: Express.Multer.File,
    requestId: string,
  ): Promise<string> {
    // Validate the image file
    validateImageFile(file);

    const uploadDir = path.join(
      process.cwd(),
      'public',
      'reimbursement-documents',
    );

    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Generate unique filename
    const fileExtension = path.extname(file.originalname);
    const fileName = `${requestId}-${Date.now()}-${Math.round(Math.random() * 1e9)}${fileExtension}`;
    const filePath = path.join(uploadDir, fileName);

    // Save file
    fs.writeFileSync(filePath, file.buffer);

    // Return the URL path
    return `/reimbursement-documents/${fileName}`;
  }

  /**
   * Upload multiple proof documents for reimbursement request
   */
  async uploadReimbursementDocuments(
    files: Express.Multer.File[],
    requestId: string,
  ): Promise<string[]> {
    const uploadPromises = files.map((file) =>
      this.uploadReimbursementDocument(file, requestId),
    );
    return Promise.all(uploadPromises);
  }

  /**
   * Delete a reimbursement document
   */
  async deleteReimbursementDocument(documentPath: string): Promise<void> {
    if (!documentPath) {
      return;
    }

    // Extract filename from path
    const fileName = documentPath.split('/').pop();
    if (!fileName) {
      return;
    }

    const filePath = path.join(
      process.cwd(),
      'public',
      'reimbursement-documents',
      fileName,
    );

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  /**
   * Delete multiple reimbursement documents
   */
  async deleteReimbursementDocuments(documentPaths: string[]): Promise<void> {
    const deletePromises = documentPaths.map((path) =>
      this.deleteReimbursementDocument(path),
    );
    await Promise.all(deletePromises);
  }
}
