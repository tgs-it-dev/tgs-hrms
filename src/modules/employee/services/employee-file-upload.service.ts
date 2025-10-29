import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class EmployeeFileUploadService {
  async uploadProfilePicture(file: Express.Multer.File, employeeId: string): Promise<string> {
    const uploadDir = path.join(process.cwd(), 'public', 'profile-pictures');

    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Generate unique filename
    const fileExtension = path.extname(file.originalname);
    const fileName = `${employeeId}-${Date.now()}${fileExtension}`;
    const filePath = path.join(uploadDir, fileName);

    // Save file
    fs.writeFileSync(filePath, file.buffer);

    // Return the URL path
    return `/profile-pictures/${fileName}`;
  }

  async uploadCnicPicture(file: Express.Multer.File, employeeId: string): Promise<string> {
    const uploadDir = path.join(process.cwd(), 'public', 'cnic-pictures');

    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Generate unique filename
    const fileExtension = path.extname(file.originalname);
    const fileName = `${employeeId}-${Date.now()}${fileExtension}`;
    const filePath = path.join(uploadDir, fileName);

    // Save file
    fs.writeFileSync(filePath, file.buffer);

    // Return the URL path
    return `/cnic-pictures/${fileName}`;
  }

  async uploadCnicBackPicture(file: Express.Multer.File, employeeId: string): Promise<string> {
    const uploadDir = path.join(process.cwd(), 'public', 'cnic-back-pictures');

    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Generate unique filename
    const fileExtension = path.extname(file.originalname);
    const fileName = `${employeeId}-${Date.now()}${fileExtension}`;
    const filePath = path.join(uploadDir, fileName);

    // Save file
    fs.writeFileSync(filePath, file.buffer);

    // Return the URL path
    return `/cnic-back-pictures/${fileName}`;
  }

  async deleteProfilePicture(profilePicUrl: string): Promise<void> {
    if (!profilePicUrl) return;

    const fileName = profilePicUrl.split('/').pop();
    if (!fileName) return;

    const filePath = path.join(process.cwd(), 'public', 'profile-pictures', fileName);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  async deleteCnicPicture(cnicPicUrl: string): Promise<void> {
    if (!cnicPicUrl) return;

    const fileName = cnicPicUrl.split('/').pop();
    if (!fileName) return;

    const filePath = path.join(process.cwd(), 'public', 'cnic-pictures', fileName);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  async deleteCnicBackPicture(cnicBackPicUrl: string): Promise<void> {
    if (!cnicBackPicUrl) return;

    const fileName = cnicBackPicUrl.split('/').pop();
    if (!fileName) return;

    const filePath = path.join(process.cwd(), 'public', 'cnic-back-pictures', fileName);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}
