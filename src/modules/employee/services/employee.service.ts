import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, SelectQueryBuilder } from 'typeorm';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { BCRYPT_SALT_ROUNDS } from '../../../common/constants/auth.constants';
import { Employee } from '../../../entities/employee.entity';
import { User } from '../../../entities/user.entity';
import { Role } from '../../../entities/role.entity';
import { CreateEmployeeDto, UpdateEmployeeDto, EmployeeQueryDto } from '../dto/employee.dto';
import { RemoveEmployeeDocumentDto } from '../dto/update-employee.dto';
import { InviteStatusService } from '../../invite-status/invite-status.service';
import { InviteStatus, UserGender, EmployeeStatus } from '../../../common/constants/enums';
import {
  EMPLOYEE_LIST_PAGE_SIZE,
  EMPLOYEE_MESSAGES,
  EMPLOYEE_RESET_TOKEN_EXPIRY_HOURS,
  EMPLOYEE_ROLE_NAMES,
} from '../../../common/constants/employee.constants';
import type {
  CreateEmployeeAfterPaymentPayload,
  EmployeeJoiningReportRow,
  EmployeeMultipartFiles,
  EmployeeWithRelations,
  GenderPercentageResult,
  PaginatedEmployees,
} from '../interfaces';
import { Response } from 'express';
import { getPostgresErrorCode } from '../../../common/types/database.types';
import { EmployeeCreationService } from './employee-creation.service';
import { EmployeeValidationService } from './employee-validation.service';
import { EmployeeNotificationService } from './employee-notification.service';
import { EmployeeFileService } from './employee-file.service';

/**
 * Employee aggregate: queries, updates, role transitions, and reports.
 * Creation / onboarding is delegated to {@link EmployeeCreationService}.
 */
@Injectable()
export class EmployeeService implements OnModuleInit {
  private readonly logger = new Logger(EmployeeService.name);

  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    private readonly inviteStatusService: InviteStatusService,
    private readonly employeeCreation: EmployeeCreationService,
    private readonly validation: EmployeeValidationService,
    private readonly notification: EmployeeNotificationService,
    private readonly employeeFile: EmployeeFileService,
  ) {}

  onModuleInit() {}

  create(
    tenant_id: string,
    createdByUserId: string,
    dto: CreateEmployeeDto,
    files?: EmployeeMultipartFiles,
    defaultRoleName: string = EMPLOYEE_ROLE_NAMES.EMPLOYEE,
  ): Promise<Employee> {
    return this.employeeCreation.create(tenant_id, createdByUserId, dto, files, defaultRoleName);
  }

  createAfterPayment(tenant_id: string, employeeData: CreateEmployeeAfterPaymentPayload): Promise<Employee> {
    return this.employeeCreation.createAfterPayment(tenant_id, employeeData);
  }

  activateAfterPayment(tenant_id: string, employeeData: CreateEmployeeAfterPaymentPayload): Promise<Employee> {
    return this.employeeCreation.activateAfterPayment(tenant_id, employeeData);
  }

  async promoteToManager(tenant_id: string, id: string) {
    const employee = await this.findOne(tenant_id, id);
    const managerRole = await this.roleRepo.findOne({
      where: { name: EMPLOYEE_ROLE_NAMES.MANAGER },
    });
    if (!managerRole) {
      throw new NotFoundException(EMPLOYEE_MESSAGES.MANAGER_ROLE_NOT_FOUND);
    }

    const user = employee.user;
    user.role_id = managerRole.id;

    try {
      await this.userRepo.save(user);
      return await this.employeeRepo.findOne({
        where: { id },
        relations: ['user', 'designation', 'designation.department', 'team'],
      });
    } catch {
      throw new BadRequestException(EMPLOYEE_MESSAGES.PROMOTE_FAILED);
    }
  }

  async demoteToEmployee(tenant_id: string, id: string) {
    const employee = await this.findOne(tenant_id, id);
    const employeeRole = await this.roleRepo.findOne({
      where: { name: EMPLOYEE_ROLE_NAMES.EMPLOYEE },
    });
    if (!employeeRole) throw new NotFoundException(EMPLOYEE_MESSAGES.EMPLOYEE_ROLE_NOT_FOUND);

    const user = employee.user;
    user.role_id = employeeRole.id;

    try {
      await this.userRepo.save(user);
      return await this.employeeRepo.findOne({
        where: { id },
        relations: ['user', 'designation', 'designation.department', 'team'],
      });
    } catch {
      throw new BadRequestException(EMPLOYEE_MESSAGES.DEMOTE_FAILED);
    }
  }

  private buildEmployeesListQuery(tenant_id: string, query: EmployeeQueryDto): SelectQueryBuilder<Employee> {
    const qb = this.employeeRepo
      .createQueryBuilder('employee')
      .leftJoinAndSelect('employee.user', 'user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('employee.designation', 'designation')
      .leftJoinAndSelect('designation.department', 'department')
      .leftJoinAndSelect('employee.team', 'team')
      .where('user.tenant_id = :tenant_id', { tenant_id });

    if (query.department_id) {
      qb.andWhere('designation.department_id = :department_id', {
        department_id: query.department_id,
      });
    }
    if (query.designation_id) {
      qb.andWhere('employee.designation_id = :designation_id', {
        designation_id: query.designation_id,
      });
    }

    if (query.search && query.search.trim().length > 0) {
      const searchTerm = `%${query.search.trim()}%`;
      qb.andWhere(
        `(
          user.first_name ILIKE :searchTerm OR
          user.last_name ILIKE :searchTerm OR
          CONCAT(user.first_name, ' ', user.last_name) ILIKE :searchTerm OR
          user.email ILIKE :searchTerm OR
          user.phone ILIKE :searchTerm OR
          employee.cnic_number ILIKE :searchTerm OR
          designation.title ILIKE :searchTerm OR
          department.name ILIKE :searchTerm OR
          team.name ILIKE :searchTerm
        )`,
        { searchTerm },
      );
    }

    return qb;
  }

  private async syncExpiredInvitesOnPage(items: Employee[]): Promise<void> {
    const now = new Date();
    const idsToExpire = items
      .filter(
        (item) =>
          item.invite_status === InviteStatus.INVITE_SENT &&
          item.status === EmployeeStatus.ACTIVE &&
          item.user?.reset_token_expiry &&
          now > item.user.reset_token_expiry,
      )
      .map((item) => item.id);

    if (!idsToExpire.length) return;

    await this.employeeRepo.update({ id: In(idsToExpire) }, { invite_status: InviteStatus.INVITE_EXPIRED });
    for (const item of items) {
      if (idsToExpire.includes(item.id)) {
        item.invite_status = InviteStatus.INVITE_EXPIRED;
      }
    }
  }

  private toEmployeeListItem(employee: Employee) {
    return {
      ...employee,
      role_name: employee.user?.role?.name ?? null,
      profile_picture: employee.user?.profile_pic ?? null,
    };
  }

  async findAll(tenant_id: string, query: EmployeeQueryDto, page: number): Promise<PaginatedEmployees> {
    const limit = EMPLOYEE_LIST_PAGE_SIZE;
    const skip = (page - 1) * limit;

    const qb = this.buildEmployeesListQuery(tenant_id, query);

    const [items, total] = await qb.orderBy('employee.created_at', 'DESC').skip(skip).take(limit).getManyAndCount();

    await this.syncExpiredInvitesOnPage(items);

    const totalPages = Math.ceil(total / limit);

    return {
      items: items.map((employee) => this.toEmployeeListItem(employee)),
      total,
      page,
      limit,
      totalPages,
    };
  }

  async findAllEmployeesForExport(tenant_id: string, query: EmployeeQueryDto): Promise<PaginatedEmployees['items']> {
    const items = await this.buildEmployeesListQuery(tenant_id, query).orderBy('employee.created_at', 'DESC').getMany();

    await this.syncExpiredInvitesOnPage(items);
    return items.map((employee) => this.toEmployeeListItem(employee));
  }

  async findOne(tenant_id: string, id: string) {
    const employee = await this.employeeRepo.findOne({
      where: { id },
      relations: ['user', 'user.role', 'designation', 'designation.department', 'team'],
    });

    if (!employee || employee.user.tenant_id !== tenant_id) {
      throw new NotFoundException(EMPLOYEE_MESSAGES.EMPLOYEE_NOT_FOUND);
    }

    const currentStatus = await this.inviteStatusService.getInviteStatus(employee.id);
    if (currentStatus != null && String(currentStatus) !== String(employee.invite_status ?? '')) {
      employee.invite_status = currentStatus as InviteStatus;
    }

    return {
      ...employee,
      role_name: employee.user?.role?.name || null,
      profile_picture: employee.user?.profile_pic || null,
    };
  }

  async update(tenant_id: string, id: string, dto: UpdateEmployeeDto, files?: EmployeeMultipartFiles) {
    const employee = await this.employeeRepo.findOne({
      where: { id },
      relations: ['user', 'designation', 'designation.department'],
    });
    if (!employee) throw new NotFoundException(EMPLOYEE_MESSAGES.EMPLOYEE_NOT_FOUND);

    const user = employee.user;
    if (!user || user.tenant_id !== tenant_id) {
      throw new NotFoundException(EMPLOYEE_MESSAGES.EMPLOYEE_NOT_FOUND);
    }

    if (dto.designation_id) {
      const newDesignation = await this.validation.validateDesignation(dto.designation_id, tenant_id);
      employee.designation_id = newDesignation.id;
      employee.designation = newDesignation;
    }

    if (dto.team_id !== undefined) {
      if (dto.team_id && dto.team_id !== null) {
        this.validation.validateUuid(dto.team_id, 'team_id');
        await this.validation.validateTeam(dto.team_id, tenant_id);
        employee.team_id = dto.team_id;
      } else {
        employee.team_id = null;
      }
    }

    if (dto.email && dto.email !== user.email) {
      const existing = await this.userRepo.findOne({ where: { email: dto.email, tenant_id } });
      if (existing && existing.id !== user.id) {
        throw new ConflictException(EMPLOYEE_MESSAGES.EMAIL_ALREADY_IN_TENANT);
      }
    }

    let shouldSaveUser = false;
    if (dto.role_name) {
      const newRole = await this.roleRepo.findOne({ where: { name: dto.role_name } });
      if (!newRole) {
        throw new NotFoundException(EMPLOYEE_MESSAGES.ROLE_NOT_FOUND_BY_NAME(dto.role_name));
      }
      user.role_id = newRole.id;
      shouldSaveUser = true;
    } else if (dto.role_id !== undefined) {
      if (dto.role_id && dto.role_id !== null) {
        this.validation.validateUuid(dto.role_id, 'role_id');
        const newRole = await this.roleRepo.findOne({ where: { id: dto.role_id } });
        if (!newRole) throw new NotFoundException(EMPLOYEE_MESSAGES.SPECIFIED_ROLE_NOT_FOUND);
        user.role_id = dto.role_id;
        shouldSaveUser = true;
      }
    }
    if (dto.first_name !== undefined) {
      user.first_name = dto.first_name;
      shouldSaveUser = true;
    }
    if (dto.last_name !== undefined) {
      user.last_name = dto.last_name;
      shouldSaveUser = true;
    }
    if (dto.email !== undefined) {
      user.email = dto.email;
      shouldSaveUser = true;
    }
    if (dto.phone !== undefined) {
      user.phone = dto.phone;
      shouldSaveUser = true;
    }
    if (dto.password) {
      user.password = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);
      shouldSaveUser = true;
    }

    if (dto.cnic_number !== undefined) {
      employee.cnic_number = dto.cnic_number;
    }

    if (files) {
      if (files.profile_picture?.[0]) {
        if (user.profile_pic) {
          try {
            this.logger.log('Deleting old profile picture:', user.profile_pic);
            await this.employeeFile.deleteProfilePicture(user.profile_pic);
            this.logger.log('Old profile picture deleted successfully');
          } catch (error) {
            this.logger.warn('Failed to delete old profile picture:', error);
          }
        }

        try {
          this.logger.log('Uploading new profile picture for employee:', employee.id);
          const profilePictureUrl = await this.employeeFile.uploadProfilePicture(files.profile_picture[0], employee.id);
          this.logger.log('Profile picture uploaded successfully:', profilePictureUrl);
          user.profile_pic = profilePictureUrl;
          shouldSaveUser = true;
        } catch (error) {
          this.logger.error('Failed to upload profile picture:', error);
          throw new BadRequestException(EMPLOYEE_MESSAGES.UPLOAD_PROFILE_FAILED);
        }
      }

      if (files.cnic_picture?.[0]) {
        if (employee.cnic_picture) {
          try {
            this.logger.log('Deleting old CNIC picture:', employee.cnic_picture);
            await this.employeeFile.deleteCnicPicture(employee.cnic_picture);
            this.logger.log('Old CNIC picture deleted successfully');
          } catch (error) {
            this.logger.warn('Failed to delete old CNIC picture:', error);
          }
        }

        try {
          this.logger.log('Uploading new CNIC picture for employee:', employee.id);
          const cnicPictureUrl = await this.employeeFile.uploadCnicPicture(files.cnic_picture[0], employee.id);
          this.logger.log('CNIC picture uploaded successfully:', cnicPictureUrl);
          employee.cnic_picture = cnicPictureUrl;
        } catch (error) {
          this.logger.error('Failed to upload CNIC picture:', error);
          throw new BadRequestException(EMPLOYEE_MESSAGES.UPLOAD_CNIC_FAILED);
        }
      }

      if (files.cnic_back_picture?.[0]) {
        if (employee.cnic_back_picture) {
          try {
            this.logger.log('Deleting old CNIC back picture:', employee.cnic_back_picture);
            await this.employeeFile.deleteCnicBackPicture(employee.cnic_back_picture);
            this.logger.log('Old CNIC back picture deleted successfully');
          } catch (error) {
            this.logger.warn('Failed to delete old CNIC back picture:', error);
          }
        }

        try {
          this.logger.log('Uploading new CNIC back picture for employee:', employee.id);
          const cnicBackPictureUrl = await this.employeeFile.uploadCnicBackPicture(
            files.cnic_back_picture[0],
            employee.id,
          );
          this.logger.log('CNIC back picture uploaded successfully:', cnicBackPictureUrl);
          employee.cnic_back_picture = cnicBackPictureUrl;
        } catch (error) {
          this.logger.error('Failed to upload CNIC back picture:', error);
          throw new BadRequestException(EMPLOYEE_MESSAGES.UPLOAD_CNIC_BACK_FAILED);
        }
      }
    }

    try {
      if (shouldSaveUser) await this.userRepo.save(user);
      await this.employeeRepo.save(employee);
      return await this.employeeRepo.findOne({
        where: { id },
        relations: ['user', 'designation', 'designation.department', 'team'],
      });
    } catch (err) {
      const errorCode = getPostgresErrorCode(err);
      if (errorCode === '23505') {
        throw new ConflictException(EMPLOYEE_MESSAGES.EMPLOYEE_ALREADY_EXISTS);
      }
      throw err;
    }
  }

  async remove(tenant_id: string, id: string): Promise<{ deleted: true; id: string }> {
    const employee = await this.employeeRepo.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!employee || employee.user.tenant_id !== tenant_id) {
      throw new NotFoundException(EMPLOYEE_MESSAGES.EMPLOYEE_NOT_FOUND);
    }

    await this.employeeRepo.manager.transaction(async (manager) => {
      const employeeRepo = manager.getRepository(Employee);
      const userRepo = manager.getRepository(User);

      await employeeRepo.delete(employee.id);
      await userRepo.delete(employee.user.id);
    });

    return { deleted: true, id };
  }

  async removeDocument(tenant_id: string, id: string, dto: RemoveEmployeeDocumentDto): Promise<Employee> {
    const employee = await this.employeeRepo.findOne({
      where: { id, user: { tenant_id } },
      relations: ['user'],
    });

    if (!employee) {
      throw new NotFoundException(EMPLOYEE_MESSAGES.EMPLOYEE_NOT_FOUND);
    }

    const { documentUrl } = dto;
    let fieldToUpdate: string | null = null;
    let isUserProfilePic = false;

    if (employee.user.profile_pic === documentUrl) {
      isUserProfilePic = true;
      await this.employeeFile.deleteProfilePicture(documentUrl);
      employee.user.profile_pic = null;
      await this.userRepo.save(employee.user);
    } else if (employee.cnic_picture === documentUrl) {
      fieldToUpdate = 'cnic_picture';
      await this.employeeFile.deleteCnicPicture(documentUrl);
    } else if (employee.cnic_back_picture === documentUrl) {
      fieldToUpdate = 'cnic_back_picture';
      await this.employeeFile.deleteCnicBackPicture(documentUrl);
    }

    if (!fieldToUpdate && !isUserProfilePic) {
      throw new NotFoundException(EMPLOYEE_MESSAGES.DOCUMENT_NOT_FOUND);
    }

    if (fieldToUpdate) {
      await this.employeeRepo.update(id, { [fieldToUpdate]: null });
    }

    const updatedEmployee = await this.employeeRepo.findOne({
      where: { id },
      relations: ['user', 'designation', 'team'],
    });

    if (!updatedEmployee) {
      throw new NotFoundException(EMPLOYEE_MESSAGES.EMPLOYEE_NOT_FOUND_AFTER_UPDATE);
    }

    return updatedEmployee;
  }

  async getGenderPercentage(tenant_id: string): Promise<GenderPercentageResult> {
    const raw = await this.employeeRepo
      .createQueryBuilder('employee')
      .leftJoin('employee.user', 'user')
      .where('user.tenant_id = :tenant_id', { tenant_id })
      .select('COUNT(employee.id)', 'total')
      .addSelect('SUM(CASE WHEN employee.status = :active THEN 1 ELSE 0 END)', 'active')
      .addSelect('SUM(CASE WHEN employee.status = :inactive THEN 1 ELSE 0 END)', 'inactive')
      .addSelect('SUM(CASE WHEN user.gender = :male AND employee.status = :active THEN 1 ELSE 0 END)', 'male')
      .addSelect('SUM(CASE WHEN user.gender = :female AND employee.status = :active THEN 1 ELSE 0 END)', 'female')
      .setParameters({
        active: EmployeeStatus.ACTIVE,
        inactive: EmployeeStatus.INACTIVE,
        male: UserGender.MALE,
        female: UserGender.FEMALE,
      })
      .getRawOne<{
        total: string;
        active: string | null;
        inactive: string | null;
        male: string | null;
        female: string | null;
      }>();

    const n = (v: string | null | undefined) => parseInt(v ?? '0', 10) || 0;

    return {
      male: n(raw?.male),
      female: n(raw?.female),
      total: n(raw?.total),
      activeEmployees: n(raw?.active),
      inactiveEmployees: n(raw?.inactive),
    };
  }

  async getEmployeeJoiningReport(tenant_id: string): Promise<EmployeeJoiningReportRow[]> {
    type JoiningReportRaw = { month: string; year: string; total: string };
    const results: JoiningReportRaw[] = await this.employeeRepo
      .createQueryBuilder('employee')
      .leftJoinAndSelect('employee.user', 'user')
      .select('EXTRACT(MONTH FROM employee.created_at) AS month')
      .addSelect('EXTRACT(YEAR FROM employee.created_at) AS year')
      .addSelect('COUNT(employee.id) AS total')
      .where('user.tenant_id = :tenant_id', { tenant_id })
      .groupBy('EXTRACT(MONTH FROM employee.created_at)')
      .addGroupBy('EXTRACT(YEAR FROM employee.created_at)')
      .orderBy('year', 'ASC')
      .addOrderBy('month', 'ASC')
      .getRawMany();

    if (!results || results.length === 0) {
      return [];
    }

    return results.map((entry) => ({
      month: parseInt(entry.month, 10),
      year: parseInt(entry.year, 10),
      total: parseInt(entry.total, 10),
    }));
  }

  async refreshInviteStatus(tenant_id: string, employee_id: string) {
    const employee = await this.employeeRepo.findOne({
      where: { id: employee_id },
      relations: ['user'],
    });
    if (!employee || employee.user.tenant_id !== tenant_id) {
      throw new NotFoundException(EMPLOYEE_MESSAGES.EMPLOYEE_NOT_FOUND_FOR_TENANT);
    }
    if (employee.invite_status !== InviteStatus.INVITE_EXPIRED) {
      throw new BadRequestException(EMPLOYEE_MESSAGES.INVITE_ONLY_WHEN_EXPIRED);
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedResetToken = await bcrypt.hash(resetToken, BCRYPT_SALT_ROUNDS);
    const resetTokenExpiry = new Date();
    resetTokenExpiry.setHours(resetTokenExpiry.getHours() + EMPLOYEE_RESET_TOKEN_EXPIRY_HOURS);
    employee.user.reset_token = hashedResetToken;
    employee.user.reset_token_expiry = resetTokenExpiry;
    employee.invite_status = InviteStatus.INVITE_SENT;
    await this.userRepo.save(employee.user);
    await this.employeeRepo.save(employee);

    await this.notification.sendPasswordResetEmail(employee.user.email, resetToken);
    return { message: EMPLOYEE_MESSAGES.INVITE_RESENT };
  }

  getProfilePictureFile(tenant_id: string, employee_id: string, res: Response): Promise<void> {
    return this.employeeFile.getProfilePictureFile(tenant_id, employee_id, res);
  }

  getCnicPictureFile(tenant_id: string, employee_id: string, res: Response): Promise<void> {
    return this.employeeFile.getCnicPictureFile(tenant_id, employee_id, res);
  }

  getCnicBackPictureFile(tenant_id: string, employee_id: string, res: Response): Promise<void> {
    return this.employeeFile.getCnicBackPictureFile(tenant_id, employee_id, res);
  }

  async getAllEmployeesForSystemAdmin(tenantId?: string): Promise<EmployeeWithRelations[]> {
    const qb = this.employeeRepo
      .createQueryBuilder('employee')
      .leftJoinAndSelect('employee.user', 'user')
      .leftJoinAndSelect('user.tenant', 'tenant')
      .leftJoinAndSelect('employee.designation', 'designation')
      .leftJoinAndSelect('designation.department', 'department')
      .leftJoinAndSelect('employee.team', 'team');

    if (tenantId) {
      qb.where('user.tenant_id = :tenantId', { tenantId });
    }

    const items = await qb
      .orderBy('tenant.name', 'ASC')
      .addOrderBy('user.first_name', 'ASC')
      .addOrderBy('user.last_name', 'ASC')
      .getMany();

    return items as EmployeeWithRelations[];
  }
}
