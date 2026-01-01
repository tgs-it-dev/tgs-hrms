import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { validateImageFile } from '../../../common/utils/file-validation.util';

@Injectable()
export class LeaveFileUploadService {
  /**
   * Upload a single image file for leave application
   */
  async uploadLeaveDocument(file: Express.Multer.File, leaveId: string): Promise<string> {
    // Validate the image file
    validateImageFile(file);
    
    const uploadDir = path.join(process.cwd(), 'public', 'leave-documents');

    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Generate unique filename
    const fileExtension = path.extname(file.originalname);
    const fileName = `${leaveId}-${Date.now()}-${Math.round(Math.random() * 1e9)}${fileExtension}`;
    const filePath = path.join(uploadDir, fileName);

    // Save file
    fs.writeFileSync(filePath, file.buffer);

    // Return the URL path
    return `/leave-documents/${fileName}`;
  }

  /**
   * Upload multiple image files for leave application
   */
  async uploadLeaveDocuments(files: Express.Multer.File[], leaveId: string): Promise<string[]> {
    const uploadPromises = files.map((file) => this.uploadLeaveDocument(file, leaveId));
    return Promise.all(uploadPromises);
  }

  /**
   * Delete a leave document file
   */
  async deleteLeaveDocument(documentUrl: string): Promise<void> {
    if (!documentUrl) return;

    const fileName = documentUrl.split('/').pop();
    if (!fileName) return;

    const filePath = path.join(process.cwd(), 'public', 'leave-documents', fileName);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  /**
   * Delete multiple leave document files
   */
  async deleteLeaveDocuments(documentUrls: string[]): Promise<void> {
    if (!documentUrls || documentUrls.length === 0) return;

    const deletePromises = documentUrls.map((url) => this.deleteLeaveDocument(url));
    await Promise.all(deletePromises);
  }
}

