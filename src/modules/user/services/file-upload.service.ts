import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { validateImageFile } from '../../../common/utils/file-validation.util';
import { S3StorageService } from "../../storage/storage.service";

const PREFIX_PROFILE = 'profile-pictures';

@Injectable()
export class FileUploadService {
  constructor(private readonly s3: S3StorageService) {}

  async uploadProfilePicture(file: Express.Multer.File, userId: string): Promise<string> {
    validateImageFile(file);
    const ext = path.extname(file.originalname);
    const fileName = `${userId}-${Date.now()}${ext}`;
    const key = `${PREFIX_PROFILE}/${fileName}`;

    if (this.s3.isEnabled()) {
      const result = await this.s3.upload(file.buffer, key, file.mimetype);
      return result.url;
    }

    const uploadDir = path.join(process.cwd(), 'public', PREFIX_PROFILE);
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, fileName);
    fs.writeFileSync(filePath, file.buffer);
    return `/${PREFIX_PROFILE}/${fileName}`;
  }

  async deleteProfilePicture(profilePicUrl: string): Promise<void> {
    if (!profilePicUrl) return;

    if (this.s3.isEnabled() && this.s3.isS3Url(profilePicUrl)) {
      await this.s3.deleteByUrl(profilePicUrl);
      return;
    }

    const fileName = profilePicUrl.split('/').pop();
    if (!fileName) return;
    const filePath = path.join(process.cwd(), 'public', PREFIX_PROFILE, fileName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
}
