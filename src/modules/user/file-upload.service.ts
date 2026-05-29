import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FileUploadService {
  uploadProfilePicture(file: Express.Multer.File, userId: string): string {
    const uploadDir = path.join(process.cwd(), 'public', 'profile-pictures');

    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Generate unique filename
    const fileExtension = path.extname(file.originalname);
    const fileName = `${userId}-${Date.now()}${fileExtension}`;
    const filePath = path.join(uploadDir, fileName);

    // Save file
    fs.writeFileSync(filePath, file.buffer);

    // Return the URL path
    return `/profile-pictures/${fileName}`;
  }

  deleteProfilePicture(profilePicUrl: string): void {
    if (!profilePicUrl) return;

    const fileName = profilePicUrl.split('/').pop();
    if (!fileName) return;

    const filePath = path.join(
      process.cwd(),
      'public',
      'profile-pictures',
      fileName,
    );

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}
