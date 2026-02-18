import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { validateImageFile } from '../../../common/utils/file-validation.util';

@Injectable()
export class FileUploadService {
  async uploadProfilePicture(file: Express.Multer.File, userId: string): Promise<string> {
    validateImageFile(file);
    const uploadDir = path.join(process.cwd(), 'public', 'profile-pictures');

  
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

  
    const fileExtension = path.extname(file.originalname);
    const fileName = `${userId}-${Date.now()}${fileExtension}`;
    const filePath = path.join(uploadDir, fileName);


    fs.writeFileSync(filePath, file.buffer);

  
    return `/profile-pictures/${fileName}`;
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
}
