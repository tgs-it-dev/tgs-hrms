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
    const key = `${PREFIX_PROFILE}/${userId}/${fileName}`;

    if (this.s3.isEnabled()) {
      const result = await this.s3.upload(file.buffer, key, file.mimetype);
      return result.url;
    }

    const uploadDir = path.join(
      process.cwd(),
      "public",
      PREFIX_PROFILE,
      userId,
    );
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    fs.writeFileSync(path.join(uploadDir, fileName), file.buffer);
    return `/${PREFIX_PROFILE}/${userId}/${fileName}`;
  }

  private localPathFromStoredUrl(prefix: string, storedUrl: string): string {
    const relative = storedUrl.replace(/^\/+/, "").split("?")[0];
    if (!relative || !relative.startsWith(prefix + "/"))
      return path.join(process.cwd(), "public", prefix, relative || "");
    return path.join(process.cwd(), "public", relative);
  }

  async deleteProfilePicture(profilePicUrl: string): Promise<void> {
    if (!profilePicUrl) return;

    if (this.s3.isEnabled() && this.s3.isS3Url(profilePicUrl)) {
      await this.s3.deleteByUrl(profilePicUrl);
      return;
    }

    const filePath = this.localPathFromStoredUrl(PREFIX_PROFILE, profilePicUrl);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
}
