import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { validateImageFile } from '../../../common/utils/file-validation.util';
import { S3StorageService } from "../../storage/storage.service";

const PREFIX_PROFILE = 'profile-pictures';
const PREFIX_CNIC = 'cnic-pictures';
const PREFIX_CNIC_BACK = 'cnic-back-pictures';

@Injectable()
export class EmployeeFileUploadService {
  constructor(private readonly s3: S3StorageService) {}

  private buildKey(prefix: string, uniqueName: string): string {
    return `${prefix}/${uniqueName}`;
  }

  private uniqueName(employeeId: string, ext: string): string {
    return `${employeeId}-${Date.now()}${ext}`;
  }

  async uploadProfilePicture(file: Express.Multer.File, employeeId: string): Promise<string> {
    validateImageFile(file);
    const ext = path.extname(file.originalname);
    const key = this.buildKey(PREFIX_PROFILE, this.uniqueName(employeeId, ext));

    if (this.s3.isEnabled()) {
      const result = await this.s3.upload(file.buffer, key, file.mimetype);
      return result.url;
    }

    const uploadDir = path.join(process.cwd(), 'public', PREFIX_PROFILE);
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    const fileName = `${employeeId}-${Date.now()}${ext}`;
    const filePath = path.join(uploadDir, fileName);
    fs.writeFileSync(filePath, file.buffer);
    return `/${PREFIX_PROFILE}/${fileName}`;
  }

  async uploadCnicPicture(file: Express.Multer.File, employeeId: string): Promise<string> {
    validateImageFile(file);
    const ext = path.extname(file.originalname);
    const key = this.buildKey(PREFIX_CNIC, this.uniqueName(employeeId, ext));

    if (this.s3.isEnabled()) {
      const result = await this.s3.upload(file.buffer, key, file.mimetype);
      return result.url;
    }

    const uploadDir = path.join(process.cwd(), 'public', PREFIX_CNIC);
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    const fileName = `${employeeId}-${Date.now()}${ext}`;
    const filePath = path.join(uploadDir, fileName);
    fs.writeFileSync(filePath, file.buffer);
    return `/${PREFIX_CNIC}/${fileName}`;
  }

  async uploadCnicBackPicture(file: Express.Multer.File, employeeId: string): Promise<string> {
    validateImageFile(file);
    const ext = path.extname(file.originalname);
    const key = this.buildKey(PREFIX_CNIC_BACK, this.uniqueName(employeeId, ext));

    if (this.s3.isEnabled()) {
      const result = await this.s3.upload(file.buffer, key, file.mimetype);
      return result.url;
    }

    const uploadDir = path.join(process.cwd(), 'public', PREFIX_CNIC_BACK);
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    const fileName = `${employeeId}-${Date.now()}${ext}`;
    const filePath = path.join(uploadDir, fileName);
    fs.writeFileSync(filePath, file.buffer);
    return `/${PREFIX_CNIC_BACK}/${fileName}`;
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

  async deleteCnicPicture(cnicPicUrl: string): Promise<void> {
    if (!cnicPicUrl) return;
    if (this.s3.isEnabled() && this.s3.isS3Url(cnicPicUrl)) {
      await this.s3.deleteByUrl(cnicPicUrl);
      return;
    }
    const fileName = cnicPicUrl.split('/').pop();
    if (!fileName) return;
    const filePath = path.join(process.cwd(), 'public', PREFIX_CNIC, fileName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  async deleteCnicBackPicture(cnicBackPicUrl: string): Promise<void> {
    if (!cnicBackPicUrl) return;
    if (this.s3.isEnabled() && this.s3.isS3Url(cnicBackPicUrl)) {
      await this.s3.deleteByUrl(cnicBackPicUrl);
      return;
    }
    const fileName = cnicBackPicUrl.split('/').pop();
    if (!fileName) return;
    const filePath = path.join(process.cwd(), 'public', PREFIX_CNIC_BACK, fileName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  saveToTempForCheckout(
    checkoutSessionId: string,
    files: {
      profile_picture?: Express.Multer.File[];
      cnic_picture?: Express.Multer.File[];
      cnic_back_picture?: Express.Multer.File[];
    },
  ): void {
    const tempDir = path.join(process.cwd(), 'public', 'temp-employee-docs', checkoutSessionId);
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    if (files.profile_picture?.[0]) {
      const ext = path.extname(files.profile_picture[0].originalname);
      fs.writeFileSync(path.join(tempDir, `profile${ext}`), files.profile_picture[0].buffer);
    }
    if (files.cnic_picture?.[0]) {
      const ext = path.extname(files.cnic_picture[0].originalname);
      fs.writeFileSync(path.join(tempDir, `cnic${ext}`), files.cnic_picture[0].buffer);
    }
    if (files.cnic_back_picture?.[0]) {
      const ext = path.extname(files.cnic_back_picture[0].originalname);
      fs.writeFileSync(path.join(tempDir, `cnic_back${ext}`), files.cnic_back_picture[0].buffer);
    }
  }

  async moveTempToFinal(
    checkoutSessionId: string,
    employeeId: string,
  ): Promise<{ profilePic?: string; cnicPic?: string; cnicBackPic?: string }> {
    const tempDir = path.join(process.cwd(), 'public', 'temp-employee-docs', checkoutSessionId);
    if (!fs.existsSync(tempDir)) return {};

    const result: { profilePic?: string; cnicPic?: string; cnicBackPic?: string } = {};

    const profileFile = fs.readdirSync(tempDir).find((f) => f.startsWith('profile'));
    if (profileFile) {
      const src = path.join(tempDir, profileFile);
      const ext = path.extname(profileFile);
      const buffer = fs.readFileSync(src);
      const unique = `${employeeId}-${Date.now()}${ext}`;

      if (this.s3.isEnabled()) {
        const uploadResult = await this.s3.upload(buffer, this.buildKey(PREFIX_PROFILE, unique), undefined);
        result.profilePic = uploadResult.url;
      } else {
        const destDir = path.join(process.cwd(), 'public', PREFIX_PROFILE);
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
        const dest = path.join(destDir, unique);
        fs.renameSync(src, dest);
        result.profilePic = `/${PREFIX_PROFILE}/${unique}`;
      }
    }

    const cnicFile = fs.readdirSync(tempDir).find((f) => f.startsWith('cnic') && !f.startsWith('cnic_back'));
    if (cnicFile) {
      const src = path.join(tempDir, cnicFile);
      const ext = path.extname(cnicFile);
      const unique = `${employeeId}-${Date.now()}${ext}`;
      const buffer = fs.readFileSync(src);

      if (this.s3.isEnabled()) {
        const uploadResult = await this.s3.upload(buffer, this.buildKey(PREFIX_CNIC, unique), undefined);
        result.cnicPic = uploadResult.url;
      } else {
        const destDir = path.join(process.cwd(), 'public', PREFIX_CNIC);
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
        const dest = path.join(destDir, unique);
        fs.renameSync(src, dest);
        result.cnicPic = `/${PREFIX_CNIC}/${unique}`;
      }
    }

    const cnicBackFile = fs.readdirSync(tempDir).find((f) => f.startsWith('cnic_back'));
    if (cnicBackFile) {
      const src = path.join(tempDir, cnicBackFile);
      const ext = path.extname(cnicBackFile);
      const unique = `${employeeId}-${Date.now()}${ext}`;
      const buffer = fs.readFileSync(src);

      if (this.s3.isEnabled()) {
        const uploadResult = await this.s3.upload(buffer, this.buildKey(PREFIX_CNIC_BACK, unique), undefined);
        result.cnicBackPic = uploadResult.url;
      } else {
        const destDir = path.join(process.cwd(), 'public', PREFIX_CNIC_BACK);
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
        const dest = path.join(destDir, unique);
        fs.renameSync(src, dest);
        result.cnicBackPic = `/${PREFIX_CNIC_BACK}/${unique}`;
      }
    }

    fs.rmSync(tempDir, { recursive: true, force: true });
    return result;
  }

  deleteTempForCheckout(checkoutSessionId: string): void {
    const tempDir = path.join(process.cwd(), 'public', 'temp-employee-docs', checkoutSessionId);
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
  }
}
