import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { validateImageFile } from '../../../common/utils/file-validation.util';

@Injectable()
export class EmployeeFileUploadService {
  async uploadProfilePicture(file: Express.Multer.File, employeeId: string): Promise<string> {
    // Additional validation as a safety check
    validateImageFile(file);
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
    // Additional validation as a safety check
    validateImageFile(file);
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
    // Additional validation as a safety check
    validateImageFile(file);
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

  /**
   * Saves files to temp folder for checkout flow (payment redirect).
   * Called before redirect when PAYMENT_METHOD_REQUIRED - files persist until createAfterPayment.
   */
  saveToTempForCheckout(
    checkoutSessionId: string,
    files: {
      profile_picture?: Express.Multer.File[];
      cnic_picture?: Express.Multer.File[];
      cnic_back_picture?: Express.Multer.File[];
    },
  ): void {
    const tempDir = path.join(process.cwd(), 'public', 'temp-employee-docs', checkoutSessionId);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    if (files.profile_picture?.[0]) {
      const ext = path.extname(files.profile_picture[0].originalname);
      fs.writeFileSync(
        path.join(tempDir, `profile${ext}`),
        files.profile_picture[0].buffer,
      );
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

  /**
   * Moves temp files to final locations and returns URLs.
   * Called from createAfterPayment when payment was completed via checkout redirect.
   */
  async moveTempToFinal(
    checkoutSessionId: string,
    employeeId: string,
  ): Promise<{ profilePic?: string; cnicPic?: string; cnicBackPic?: string }> {
    const tempDir = path.join(process.cwd(), 'public', 'temp-employee-docs', checkoutSessionId);
    if (!fs.existsSync(tempDir)) {
      return {};
    }

    const result: { profilePic?: string; cnicPic?: string; cnicBackPic?: string } = {};

    const profileFile = fs.readdirSync(tempDir).find((f) => f.startsWith('profile'));
    if (profileFile) {
      const src = path.join(tempDir, profileFile);
      const ext = path.extname(profileFile);
      const destDir = path.join(process.cwd(), 'public', 'profile-pictures');
      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
      const destFileName = `${employeeId}-${Date.now()}${ext}`;
      const dest = path.join(destDir, destFileName);
      fs.renameSync(src, dest);
      result.profilePic = `/profile-pictures/${destFileName}`;
    }

    const cnicFile = fs.readdirSync(tempDir).find((f) => f.startsWith('cnic') && !f.startsWith('cnic_back'));
    if (cnicFile) {
      const src = path.join(tempDir, cnicFile);
      const ext = path.extname(cnicFile);
      const destDir = path.join(process.cwd(), 'public', 'cnic-pictures');
      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
      const destFileName = `${employeeId}-${Date.now()}${ext}`;
      const dest = path.join(destDir, destFileName);
      fs.renameSync(src, dest);
      result.cnicPic = `/cnic-pictures/${destFileName}`;
    }

    const cnicBackFile = fs.readdirSync(tempDir).find((f) => f.startsWith('cnic_back'));
    if (cnicBackFile) {
      const src = path.join(tempDir, cnicBackFile);
      const ext = path.extname(cnicBackFile);
      const destDir = path.join(process.cwd(), 'public', 'cnic-back-pictures');
      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
      const destFileName = `${employeeId}-${Date.now()}${ext}`;
      const dest = path.join(destDir, destFileName);
      fs.renameSync(src, dest);
      result.cnicBackPic = `/cnic-back-pictures/${destFileName}`;
    }

    fs.rmSync(tempDir, { recursive: true, force: true });
    return result;
  }

  /** Removes temp folder if payment cancelled or failed (cleanup). */
  deleteTempForCheckout(checkoutSessionId: string): void {
    const tempDir = path.join(process.cwd(), 'public', 'temp-employee-docs', checkoutSessionId);
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}
