import { Injectable } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import { validateImageFile } from "../../../common/utils/file-validation.util";
import { S3StorageService } from "../../storage/storage.service";

const PREFIX_PROFILE = "profile-pictures";
const PREFIX_CNIC = "cnic-pictures";
const PREFIX_CNIC_BACK = "cnic-back-pictures";

@Injectable()
export class EmployeeFileUploadService {
  constructor(private readonly s3: S3StorageService) {}

  /** S3 key: prefix/userId/fileName (e.g. profile-pictures/userId/employeeId-timestamp.ext) */
  private buildKey(prefix: string, userId: string, uniqueName: string): string {
    return `${prefix}/${userId}/${uniqueName}`;
  }

  private uniqueName(employeeId: string, ext: string): string {
    return `${employeeId}-${Date.now()}${ext}`;
  }

  async uploadProfilePicture(
    file: Express.Multer.File,
    employeeId: string,
    userId: string,
  ): Promise<string> {
    validateImageFile(file);
    const ext = path.extname(file.originalname);
    const fileName = this.uniqueName(employeeId, ext);
    const key = this.buildKey(PREFIX_PROFILE, userId, fileName);

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

  async uploadCnicPicture(
    file: Express.Multer.File,
    employeeId: string,
    userId: string,
  ): Promise<string> {
    validateImageFile(file);
    const ext = path.extname(file.originalname);
    const fileName = this.uniqueName(employeeId, ext);
    const key = this.buildKey(PREFIX_CNIC, userId, fileName);

    if (this.s3.isEnabled()) {
      const result = await this.s3.upload(file.buffer, key, file.mimetype);
      return result.url;
    }

    const uploadDir = path.join(process.cwd(), "public", PREFIX_CNIC, userId);
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    fs.writeFileSync(path.join(uploadDir, fileName), file.buffer);
    return `/${PREFIX_CNIC}/${userId}/${fileName}`;
  }

  async uploadCnicBackPicture(
    file: Express.Multer.File,
    employeeId: string,
    userId: string,
  ): Promise<string> {
    validateImageFile(file);
    const ext = path.extname(file.originalname);
    const fileName = this.uniqueName(employeeId, ext);
    const key = this.buildKey(PREFIX_CNIC_BACK, userId, fileName);

    if (this.s3.isEnabled()) {
      const result = await this.s3.upload(file.buffer, key, file.mimetype);
      return result.url;
    }

    const uploadDir = path.join(
      process.cwd(),
      "public",
      PREFIX_CNIC_BACK,
      userId,
    );
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    fs.writeFileSync(path.join(uploadDir, fileName), file.buffer);
    return `/${PREFIX_CNIC_BACK}/${userId}/${fileName}`;
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

  async deleteCnicPicture(cnicPicUrl: string): Promise<void> {
    if (!cnicPicUrl) return;
    if (this.s3.isEnabled() && this.s3.isS3Url(cnicPicUrl)) {
      await this.s3.deleteByUrl(cnicPicUrl);
      return;
    }
    const filePath = this.localPathFromStoredUrl(PREFIX_CNIC, cnicPicUrl);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  async deleteCnicBackPicture(cnicBackPicUrl: string): Promise<void> {
    if (!cnicBackPicUrl) return;
    if (this.s3.isEnabled() && this.s3.isS3Url(cnicBackPicUrl)) {
      await this.s3.deleteByUrl(cnicBackPicUrl);
      return;
    }
    const filePath = this.localPathFromStoredUrl(
      PREFIX_CNIC_BACK,
      cnicBackPicUrl,
    );
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
    const tempDir = path.join(
      process.cwd(),
      "public",
      "temp-employee-docs",
      checkoutSessionId,
    );
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    if (files.profile_picture?.[0]) {
      const ext = path.extname(files.profile_picture[0].originalname);
      fs.writeFileSync(
        path.join(tempDir, `profile${ext}`),
        files.profile_picture[0].buffer,
      );
    }
    if (files.cnic_picture?.[0]) {
      const ext = path.extname(files.cnic_picture[0].originalname);
      fs.writeFileSync(
        path.join(tempDir, `cnic${ext}`),
        files.cnic_picture[0].buffer,
      );
    }
    if (files.cnic_back_picture?.[0]) {
      const ext = path.extname(files.cnic_back_picture[0].originalname);
      fs.writeFileSync(
        path.join(tempDir, `cnic_back${ext}`),
        files.cnic_back_picture[0].buffer,
      );
    }
  }

  async moveTempToFinal(
    checkoutSessionId: string,
    employeeId: string,
    userId: string,
  ): Promise<{ profilePic?: string; cnicPic?: string; cnicBackPic?: string }> {
    const tempDir = path.join(
      process.cwd(),
      "public",
      "temp-employee-docs",
      checkoutSessionId,
    );
    if (!fs.existsSync(tempDir)) return {};

    const result: {
      profilePic?: string;
      cnicPic?: string;
      cnicBackPic?: string;
    } = {};

    const profileFile = fs
      .readdirSync(tempDir)
      .find((f) => f.startsWith("profile"));
    if (profileFile) {
      const src = path.join(tempDir, profileFile);
      const ext = path.extname(profileFile);
      const buffer = fs.readFileSync(src);
      const unique = this.uniqueName(employeeId, ext);

      if (this.s3.isEnabled()) {
        const uploadResult = await this.s3.upload(
          buffer,
          this.buildKey(PREFIX_PROFILE, userId, unique),
          undefined,
        );
        result.profilePic = uploadResult.url;
      } else {
        const destDir = path.join(
          process.cwd(),
          "public",
          PREFIX_PROFILE,
          userId,
        );
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
        fs.renameSync(src, path.join(destDir, unique));
        result.profilePic = `/${PREFIX_PROFILE}/${userId}/${unique}`;
      }
    }

    const cnicFile = fs
      .readdirSync(tempDir)
      .find((f) => f.startsWith("cnic") && !f.startsWith("cnic_back"));
    if (cnicFile) {
      const src = path.join(tempDir, cnicFile);
      const ext = path.extname(cnicFile);
      const unique = this.uniqueName(employeeId, ext);
      const buffer = fs.readFileSync(src);

      if (this.s3.isEnabled()) {
        const uploadResult = await this.s3.upload(
          buffer,
          this.buildKey(PREFIX_CNIC, userId, unique),
          undefined,
        );
        result.cnicPic = uploadResult.url;
      } else {
        const destDir = path.join(process.cwd(), "public", PREFIX_CNIC, userId);
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
        fs.renameSync(src, path.join(destDir, unique));
        result.cnicPic = `/${PREFIX_CNIC}/${userId}/${unique}`;
      }
    }

    const cnicBackFile = fs
      .readdirSync(tempDir)
      .find((f) => f.startsWith("cnic_back"));
    if (cnicBackFile) {
      const src = path.join(tempDir, cnicBackFile);
      const ext = path.extname(cnicBackFile);
      const unique = this.uniqueName(employeeId, ext);
      const buffer = fs.readFileSync(src);

      if (this.s3.isEnabled()) {
        const uploadResult = await this.s3.upload(
          buffer,
          this.buildKey(PREFIX_CNIC_BACK, userId, unique),
          undefined,
        );
        result.cnicBackPic = uploadResult.url;
      } else {
        const destDir = path.join(
          process.cwd(),
          "public",
          PREFIX_CNIC_BACK,
          userId,
        );
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
        fs.renameSync(src, path.join(destDir, unique));
        result.cnicBackPic = `/${PREFIX_CNIC_BACK}/${userId}/${unique}`;
      }
    }

    fs.rmSync(tempDir, { recursive: true, force: true });
    return result;
  }

  deleteTempForCheckout(checkoutSessionId: string): void {
    const tempDir = path.join(
      process.cwd(),
      "public",
      "temp-employee-docs",
      checkoutSessionId,
    );
    if (fs.existsSync(tempDir))
      fs.rmSync(tempDir, { recursive: true, force: true });
  }
}
