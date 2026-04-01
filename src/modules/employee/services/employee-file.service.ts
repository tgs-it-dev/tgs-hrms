import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Response } from 'express';
import { Employee } from '../../../entities/employee.entity';
import { EMPLOYEE_MESSAGES } from '../../../common/constants/employee.constants';
import { FileStorageService } from '../../../common/services/file-storage.service';
import { EMPLOYEE_FILE_BUCKETS } from '../../../common/constants/file-storage.constants';

/**
 * Employee file operations: multipart uploads to disk, deletes, and streaming responses for stored assets.
 */
@Injectable()
export class EmployeeFileService {
  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    private readonly fileStorage: FileStorageService,
  ) {}

  uploadProfilePicture(file: Express.Multer.File, employeeId: string): Promise<string> {
    return Promise.resolve(this.fileStorage.saveImageFile(file, EMPLOYEE_FILE_BUCKETS.PROFILE_PICTURES, employeeId));
  }

  uploadCnicPicture(file: Express.Multer.File, employeeId: string): Promise<string> {
    return Promise.resolve(this.fileStorage.saveImageFile(file, EMPLOYEE_FILE_BUCKETS.CNIC_PICTURES, employeeId));
  }

  uploadCnicBackPicture(file: Express.Multer.File, employeeId: string): Promise<string> {
    return Promise.resolve(this.fileStorage.saveImageFile(file, EMPLOYEE_FILE_BUCKETS.CNIC_BACK_PICTURES, employeeId));
  }

  deleteProfilePicture(profilePicUrl: string): Promise<void> {
    this.fileStorage.deleteByUrl(profilePicUrl, EMPLOYEE_FILE_BUCKETS.PROFILE_PICTURES);
    return Promise.resolve();
  }

  deleteCnicPicture(cnicPicUrl: string): Promise<void> {
    this.fileStorage.deleteByUrl(cnicPicUrl, EMPLOYEE_FILE_BUCKETS.CNIC_PICTURES);
    return Promise.resolve();
  }

  deleteCnicBackPicture(cnicBackPicUrl: string): Promise<void> {
    this.fileStorage.deleteByUrl(cnicBackPicUrl, EMPLOYEE_FILE_BUCKETS.CNIC_BACK_PICTURES);
    return Promise.resolve();
  }

  async getProfilePictureFile(tenant_id: string, employee_id: string, res: Response): Promise<void> {
    const employee = await this.employeeRepo.findOne({
      where: { id: employee_id },
      relations: ['user'],
    });

    if (!employee || employee.user.tenant_id !== tenant_id) {
      throw new NotFoundException(EMPLOYEE_MESSAGES.EMPLOYEE_NOT_FOUND);
    }

    const imagePath = employee.user?.profile_pic;
    if (!imagePath) {
      throw new NotFoundException(EMPLOYEE_MESSAGES.NO_PROFILE_PICTURE);
    }

    const fileName = imagePath.split('/').pop();
    if (!fileName) {
      throw new NotFoundException(EMPLOYEE_MESSAGES.INVALID_IMAGE_PATH);
    }

    const filePath = this.fileStorage.buildAbsolutePath(EMPLOYEE_FILE_BUCKETS.PROFILE_PICTURES, fileName);
    if (!this.fileStorage.exists(filePath)) {
      throw new NotFoundException(EMPLOYEE_MESSAGES.PROFILE_FILE_NOT_FOUND);
    }

    this.fileStorage.streamFileInline(res, filePath, fileName);
  }

  async getCnicPictureFile(tenant_id: string, employee_id: string, res: Response): Promise<void> {
    const employee = await this.employeeRepo.findOne({
      where: { id: employee_id },
      relations: ['user'],
    });

    if (!employee || employee.user.tenant_id !== tenant_id) {
      throw new NotFoundException(EMPLOYEE_MESSAGES.EMPLOYEE_NOT_FOUND);
    }

    if (!employee.cnic_picture) {
      throw new NotFoundException(EMPLOYEE_MESSAGES.NO_CNIC_PICTURE);
    }

    const fileName = employee.cnic_picture.split('/').pop();
    if (!fileName) {
      throw new NotFoundException(EMPLOYEE_MESSAGES.INVALID_CNIC_PATH);
    }

    const filePath = this.fileStorage.buildAbsolutePath(EMPLOYEE_FILE_BUCKETS.CNIC_PICTURES, fileName);
    if (!this.fileStorage.exists(filePath)) {
      throw new NotFoundException(EMPLOYEE_MESSAGES.CNIC_FILE_NOT_FOUND);
    }

    this.fileStorage.streamFileInline(res, filePath, fileName);
  }

  async getCnicBackPictureFile(tenant_id: string, employee_id: string, res: Response): Promise<void> {
    const employee = await this.employeeRepo.findOne({
      where: { id: employee_id },
      relations: ['user'],
    });

    if (!employee || employee.user.tenant_id !== tenant_id) {
      throw new NotFoundException(EMPLOYEE_MESSAGES.EMPLOYEE_NOT_FOUND);
    }

    if (!employee.cnic_back_picture) {
      throw new NotFoundException(EMPLOYEE_MESSAGES.NO_CNIC_BACK);
    }

    const fileName = employee.cnic_back_picture.split('/').pop();
    if (!fileName) {
      throw new NotFoundException(EMPLOYEE_MESSAGES.INVALID_CNIC_BACK_PATH);
    }

    const filePath = this.fileStorage.buildAbsolutePath(EMPLOYEE_FILE_BUCKETS.CNIC_BACK_PICTURES, fileName);
    if (!this.fileStorage.exists(filePath)) {
      throw new NotFoundException(EMPLOYEE_MESSAGES.CNIC_BACK_FILE_NOT_FOUND);
    }

    this.fileStorage.streamFileInline(res, filePath, fileName);
  }
}
