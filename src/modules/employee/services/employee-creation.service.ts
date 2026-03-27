import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { BCRYPT_SALT_ROUNDS } from '../../../common/constants/auth.constants';
import { Employee } from '../../../entities/employee.entity';
import { User } from '../../../entities/user.entity';
import { CreateEmployeeDto } from '../dto/employee.dto';
import { EmployeeCreatedEvent } from '../../billing/events/employee-created.event';
import { BillingService } from '../../billing/services/billing.service';
import { EmployeeStatus, InviteStatus, SalaryStatus } from '../../../common/constants/enums';
import {
  EMPLOYEE_MESSAGES,
  EMPLOYEE_PAYMENT_ERROR_MARKERS,
  EMPLOYEE_RESET_TOKEN_EXPIRY_HOURS,
  EMPLOYEE_ROLE_NAMES,
  EMPLOYEE_SALARY_NOTES,
} from '../../../common/constants/employee.constants';
import type {
  CreateEmployeeAfterPaymentPayload,
  EmployeeCreationLifecycle,
  EmployeeMultipartFiles,
} from '../interfaces';
import { getPostgresErrorCode } from '../../../common/types/database.types';
import { EmployeeSalaryService } from '../../payroll/services/employee-salary.service';
import { CreateEmployeeSalaryDto } from '../../payroll/dto/employee-salary.dto';
import { EmployeeValidationService } from './employee-validation.service';
import { EmployeeNotificationService } from './employee-notification.service';
import { EmployeeFileService } from './employee-file.service';

/**
 * Employee onboarding: persistence, billing gate, salary template, invites, and domain events.
 */
@Injectable()
export class EmployeeCreationService {
  private readonly logger = new Logger(EmployeeCreationService.name);

  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly validation: EmployeeValidationService,
    private readonly notification: EmployeeNotificationService,
    private readonly fileService: EmployeeFileService,
    private readonly billingService: BillingService,
    private readonly employeeSalaryService: EmployeeSalaryService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(
    tenant_id: string,
    createdByUserId: string,
    dto: CreateEmployeeDto,
    files?: EmployeeMultipartFiles,
    defaultRoleName: string = EMPLOYEE_ROLE_NAMES.EMPLOYEE,
  ): Promise<Employee> {
    const isManagerDefault = defaultRoleName === EMPLOYEE_ROLE_NAMES.MANAGER;
    return this.createEmployeeWithLifecycle(tenant_id, createdByUserId, dto, files, {
      runBilling: !isManagerDefault,
      emitCreatedEvent: !isManagerDefault,
      defaultRoleName,
      salaryNote: isManagerDefault ? EMPLOYEE_SALARY_NOTES.ON_MANAGER_CREATE : EMPLOYEE_SALARY_NOTES.ON_STANDARD_CREATE,
    });
  }

  async createAfterPayment(tenant_id: string, employeeData: CreateEmployeeAfterPaymentPayload): Promise<Employee> {
    const dto: CreateEmployeeDto = {
      email: employeeData.email,
      phone: employeeData.phone,
      first_name: employeeData.first_name,
      last_name: employeeData.last_name,
      designation_id: employeeData.designation_id,
      team_id: employeeData.team_id,
      role_id: employeeData.role_id,
      role_name: employeeData.role_name,
      gender: this.validation.parseOptionalGender(employeeData.gender),
      cnic_number: employeeData.cnic_number,
      password: employeeData.password,
    };

    const result = await this.createEmployeeWithLifecycle(tenant_id, '', dto, undefined, {
      runBilling: false,
      emitCreatedEvent: false,
      defaultRoleName: EMPLOYEE_ROLE_NAMES.EMPLOYEE,
      salaryNote: EMPLOYEE_SALARY_NOTES.ON_CREATE_AFTER_PAYMENT,
      useNewEmployeeAsSalaryActor: true,
    });

    if (employeeData.profile_picture_url || employeeData.cnic_picture_url || employeeData.cnic_back_picture_url) {
      const user = await this.userRepo.findOne({ where: { id: result.user_id } });
      if (user && employeeData.profile_picture_url) {
        user.profile_pic = employeeData.profile_picture_url;
        await this.userRepo.save(user);
      }

      if (employeeData.cnic_picture_url) {
        result.cnic_picture = employeeData.cnic_picture_url;
      }
      if (employeeData.cnic_back_picture_url) {
        result.cnic_back_picture = employeeData.cnic_back_picture_url;
      }
      await this.employeeRepo.save(result);
    }

    this.logger.log(`Employee created successfully after payment: ${result.id} (tenant: ${tenant_id})`);
    return result;
  }

  /**
   * Activates a previously-created (pending) employee/user after successful checkout payment.
   * HRMS "Draft/Pending state" approach:
   * - keep DB rows (do not delete/recreate)
   * - mark employee ACTIVE
   * - generate a fresh reset token and send the password-reset email
   * - create default salary only once
   */
  async activateAfterPayment(
    tenant_id: string,
    employeeData: CreateEmployeeAfterPaymentPayload,
  ): Promise<Employee> {
    const email = employeeData.email?.toLowerCase();
    if (!email) {
      throw new BadRequestException('Employee email missing from payment metadata');
    }

    const user = await this.userRepo.findOne({
      where: { email },
      relations: ['role'],
    });

    if (!user || user.tenant_id !== tenant_id) {
      throw new NotFoundException(EMPLOYEE_MESSAGES.EMPLOYEE_NOT_FOUND);
    }

    const employee = await this.employeeRepo.findOne({
      where: { user_id: user.id },
      relations: ['user', 'designation', 'team'],
    });

    if (!employee) {
      throw new NotFoundException(EMPLOYEE_MESSAGES.EMPLOYEE_NOT_FOUND);
    }

    const isAlreadyActive = employee.status === EmployeeStatus.ACTIVE;

    // Apply file URLs from payment metadata even on idempotent retries.
    let shouldPersist = false;
    if (employeeData.profile_picture_url && user.profile_pic !== employeeData.profile_picture_url) {
      user.profile_pic = employeeData.profile_picture_url;
      shouldPersist = true;
    }
    if (employeeData.cnic_picture_url && employee.cnic_picture !== employeeData.cnic_picture_url) {
      employee.cnic_picture = employeeData.cnic_picture_url;
      shouldPersist = true;
    }
    if (employeeData.cnic_back_picture_url && employee.cnic_back_picture !== employeeData.cnic_back_picture_url) {
      employee.cnic_back_picture = employeeData.cnic_back_picture_url;
      shouldPersist = true;
    }

    if (shouldPersist) {
      await this.userRepo.save(user);
      await this.employeeRepo.save(employee);
    }

    // Idempotency: if already activated, don't resend emails or create salary again.
    if (isAlreadyActive) return employee;

    // Mark ACTIVE and persist.
    employee.status = EmployeeStatus.ACTIVE;
    await this.employeeRepo.save(employee);

    // Create a fresh reset token for the password-set flow.
    const { resetToken, hashedResetToken, resetTokenExpiry } = await this.buildResetTokenOnly();
    await this.userRepo.update(user.id, {
      reset_token: hashedResetToken,
      reset_token_expiry: resetTokenExpiry,
    });

    const employeeName = `${user.first_name} ${user.last_name}`.trim();

    // Send password reset email and tenant announcement.
    await this.notification.sendPasswordResetEmail(user.email, resetToken);
    await this.notification.sendNewEmployeeAnnouncementToTenant(
      tenant_id,
      user.id,
      employeeName,
      user.email,
    );

    // Create default salary only if it doesn't exist yet.
    const { salary } = await this.employeeSalaryService.getByEmployeeId(employee.id, tenant_id);
    if (!salary) {
      await this.ensureDefaultSalary(tenant_id, user.id, employee.id, EMPLOYEE_SALARY_NOTES.ON_CREATE_AFTER_PAYMENT);
    }

    return employee;
  }

  private generateTemporaryPassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    return Array.from({ length: 12 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
  }

  private async buildResetTokenOnly(): Promise<{
    resetToken: string;
    hashedResetToken: string;
    resetTokenExpiry: Date;
  }> {
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedResetToken = await bcrypt.hash(resetToken, BCRYPT_SALT_ROUNDS);
    const resetTokenExpiry = new Date();
    resetTokenExpiry.setHours(resetTokenExpiry.getHours() + EMPLOYEE_RESET_TOKEN_EXPIRY_HOURS);
    return { resetToken, hashedResetToken, resetTokenExpiry };
  }

  private async buildPasswordAndResetToken(dto: CreateEmployeeDto): Promise<{
    hashedPassword: string;
    resetToken: string;
    hashedResetToken: string;
    resetTokenExpiry: Date;
  }> {
    const password = dto.password || this.generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedResetToken = await bcrypt.hash(resetToken, BCRYPT_SALT_ROUNDS);
    const resetTokenExpiry = new Date();
    resetTokenExpiry.setHours(resetTokenExpiry.getHours() + EMPLOYEE_RESET_TOKEN_EXPIRY_HOURS);
    return { hashedPassword, resetToken, hashedResetToken, resetTokenExpiry };
  }

  private async transactionSaveNewEmployee(
    tenant_id: string,
    dto: CreateEmployeeDto,
    roleId: string,
    bundles: { hashedPassword: string; hashedResetToken: string; resetTokenExpiry: Date },
  ): Promise<Employee> {
    return this.userRepo.manager.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const employeeRepo = manager.getRepository(Employee);

      const user = userRepo.create({
        email: dto.email.toLowerCase(),
        phone: dto.phone,
        password: bundles.hashedPassword,
        first_name: dto.first_name,
        last_name: dto.last_name,
        gender: dto.gender ?? null,
        role_id: roleId,
        tenant_id,
        reset_token: bundles.hashedResetToken,
        reset_token_expiry: bundles.resetTokenExpiry,
      });
      const savedUser = await userRepo.save(user);

      const employee = employeeRepo.create({
        user_id: savedUser.id,
        designation_id: dto.designation_id,
        team_id: dto.team_id || null,
        invite_status: InviteStatus.INVITE_SENT,
        cnic_number: dto.cnic_number || null,
      });
      return employeeRepo.save(employee);
    });
  }

  private async applyCreationFileUploads(
    result: Employee,
    files: EmployeeMultipartFiles,
  ): Promise<{
    profile_picture_url?: string;
    cnic_picture_url?: string;
    cnic_back_picture_url?: string;
  }> {
    const uploaded: {
      profile_picture_url?: string;
      cnic_picture_url?: string;
      cnic_back_picture_url?: string;
    } = {};
    try {
      const profileFile = files.profile_picture?.[0];
      if (profileFile) {
        const profilePictureUrl = await this.fileService.uploadProfilePicture(profileFile, result.id);
        uploaded.profile_picture_url = profilePictureUrl;
        const user = await this.userRepo.findOne({ where: { id: result.user_id } });
        if (user) {
          user.profile_pic = profilePictureUrl;
          await this.userRepo.save(user);
        }
      }

      const cnicFile = files.cnic_picture?.[0];
      if (cnicFile) {
        result.cnic_picture = await this.fileService.uploadCnicPicture(cnicFile, result.id);
        uploaded.cnic_picture_url = result.cnic_picture;
      }

      const cnicBackFile = files.cnic_back_picture?.[0];
      if (cnicBackFile) {
        result.cnic_back_picture = await this.fileService.uploadCnicBackPicture(cnicBackFile, result.id);
        uploaded.cnic_back_picture_url = result.cnic_back_picture;
      }

      await this.employeeRepo.save(result);
      return uploaded;
    } catch (uploadError) {
      await this.employeeRepo.delete(result.id);
      await this.userRepo.delete(result.user_id);
      throw uploadError;
    }
  }

  private async cleanupUploadedFiles(
    uploaded: { profile_picture_url?: string; cnic_picture_url?: string; cnic_back_picture_url?: string } | null,
  ): Promise<void> {
    if (!uploaded) return;
    if (uploaded.profile_picture_url) {
      await this.fileService.deleteProfilePicture(uploaded.profile_picture_url);
    }
    if (uploaded.cnic_picture_url) {
      await this.fileService.deleteCnicPicture(uploaded.cnic_picture_url);
    }
    if (uploaded.cnic_back_picture_url) {
      await this.fileService.deleteCnicBackPicture(uploaded.cnic_back_picture_url);
    }
  }

  private async runBillingAndMaybeCheckout(
    tenant_id: string,
    dto: CreateEmployeeDto,
    result: Employee,
    user: User,
    event: EmployeeCreatedEvent,
    uploadedFiles: { profile_picture_url?: string; cnic_picture_url?: string; cnic_back_picture_url?: string } | null,
  ): Promise<void> {
    try {
      await this.billingService.handleEmployeeCreated(event);
      this.logger.log(`Payment processed successfully for employee: ${result.id} (tenant: ${tenant_id})`);
    } catch (paymentError) {
      const msg = this.notification.errorMessage(paymentError);
      this.logger.error(`Payment failed for employee creation: ${result.id}. Error: ${msg}`);

      const needsCheckout = EMPLOYEE_PAYMENT_ERROR_MARKERS.some((m) => msg.includes(m));
      if (needsCheckout) {
        // Draft/Pending state model:
        // keep the employee/user rows and mark employee as pending/inactive until payment is confirmed.
        result.status = EmployeeStatus.INACTIVE;
        await this.employeeRepo.save(result);

        try {
          const checkout = await this.billingService.createEmployeePaymentCheckout(tenant_id, {
            email: dto.email,
            phone: dto.phone,
            first_name: dto.first_name,
            last_name: dto.last_name,
            designation_id: dto.designation_id,
            team_id: dto.team_id,
            role_id: dto.role_id,
            role_name: dto.role_name,
            gender: dto.gender,
            cnic_number: dto.cnic_number,
            password: dto.password,
            profile_picture_url: uploadedFiles?.profile_picture_url,
            cnic_picture_url: uploadedFiles?.cnic_picture_url,
            cnic_back_picture_url: uploadedFiles?.cnic_back_picture_url,
          });

          this.logger.log(`Checkout session created: ${checkout.checkoutSessionId}, URL: ${checkout.checkoutUrl}`);

          throw new BadRequestException({
            message: EMPLOYEE_MESSAGES.PAYMENT_METHOD_REQUIRED,
            checkoutUrl: checkout.checkoutUrl,
            checkoutSessionId: checkout.checkoutSessionId,
            requiresPayment: true,
          });
        } catch (checkoutError) {
          if (checkoutError instanceof BadRequestException) {
            throw checkoutError;
          }
          // No checkout session was created; clean up uploaded files + remove pending records to avoid orphans.
          await this.employeeRepo.remove(result);
          await this.userRepo.remove(user);
          await this.cleanupUploadedFiles(uploadedFiles);
          const checkoutMsg = this.notification.errorMessage(checkoutError);
          this.logger.error(
            `Failed to create checkout session: ${checkoutMsg}`,
            checkoutError instanceof Error ? checkoutError.stack : undefined,
          );
          throw new BadRequestException({
            message: EMPLOYEE_MESSAGES.PAYMENT_CHECKOUT_FAILED(checkoutMsg),
            originalError: checkoutMsg,
            requiresPayment: true,
          });
        }
      }

      await this.employeeRepo.remove(result);
      await this.userRepo.remove(user);
      await this.cleanupUploadedFiles(uploadedFiles);
      throw new BadRequestException(EMPLOYEE_MESSAGES.PAYMENT_FAILED_PREFIX(msg));
    }
  }

  private async ensureDefaultSalary(
    tenant_id: string,
    actorUserId: string,
    employeeId: string,
    note: string,
  ): Promise<void> {
    try {
      const defaults = await this.employeeSalaryService.getSalaryTemplateForTenant(tenant_id);
      const today = new Date().toISOString().split('T')[0];
      const salaryDto: CreateEmployeeSalaryDto = {
        employee_id: employeeId,
        baseSalary: defaults.baseSalary,
        allowances: defaults.allowances,
        deductions: defaults.deductions,
        effectiveDate: today,
        status: SalaryStatus.ACTIVE,
        notes: note,
      };
      await this.employeeSalaryService.create(tenant_id, actorUserId, salaryDto);
    } catch (salaryError) {
      this.logger.error(
        `Failed to create default salary for ${employeeId}: ${this.notification.errorMessage(salaryError)}`,
      );
    }
  }

  private async createEmployeeWithLifecycle(
    tenant_id: string,
    actorUserId: string,
    dto: CreateEmployeeDto,
    files: EmployeeMultipartFiles | undefined,
    lifecycle: EmployeeCreationLifecycle,
  ): Promise<Employee> {
    await this.validation.assertCreateEmployeePreconditions(tenant_id, dto);
    const role = await this.validation.resolveRoleForCreation(dto, lifecycle.defaultRoleName);
    const tokens = await this.buildPasswordAndResetToken(dto);

    try {
      const result = await this.transactionSaveNewEmployee(tenant_id, dto, role.id, {
        hashedPassword: tokens.hashedPassword,
        hashedResetToken: tokens.hashedResetToken,
        resetTokenExpiry: tokens.resetTokenExpiry,
      });

      let uploadedFiles: {
        profile_picture_url?: string;
        cnic_picture_url?: string;
        cnic_back_picture_url?: string;
      } | null = null;
      if (files) {
        uploadedFiles = await this.applyCreationFileUploads(result, files);
      }

      const user = await this.userRepo.findOne({ where: { id: result.user_id } });
      if (!user) {
        throw new NotFoundException(EMPLOYEE_MESSAGES.USER_NOT_FOUND_AFTER_CREATE);
      }

      const employeeName = `${user.first_name} ${user.last_name}`.trim();
      const billingEvent = new EmployeeCreatedEvent(tenant_id, result.id, user.email, employeeName);

      if (lifecycle.runBilling) {
        await this.runBillingAndMaybeCheckout(tenant_id, dto, result, user, billingEvent, uploadedFiles);
      }

      await this.notification.sendPasswordResetEmail(dto.email, tokens.resetToken);
      await this.notification.sendNewEmployeeAnnouncementToTenant(tenant_id, user.id, employeeName, user.email);

      const salaryActor = lifecycle.useNewEmployeeAsSalaryActor ? result.user_id : actorUserId;
      await this.ensureDefaultSalary(tenant_id, salaryActor, result.id, lifecycle.salaryNote);

      if (lifecycle.emitCreatedEvent) {
        try {
          this.eventEmitter.emit('employee.created', billingEvent);
          this.logger.log(`Emitted employee.created event for employee: ${result.id} (tenant: ${tenant_id})`);
        } catch (eventError) {
          this.logger.error(`Failed to emit employee.created event: ${this.notification.errorMessage(eventError)}`);
        }
      }

      return result;
    } catch (err) {
      const errorCode = getPostgresErrorCode(err);
      if (errorCode === '23505') {
        throw new ConflictException(
          lifecycle.defaultRoleName === EMPLOYEE_ROLE_NAMES.MANAGER
            ? EMPLOYEE_MESSAGES.MANAGER_ALREADY_EXISTS
            : EMPLOYEE_MESSAGES.EMPLOYEE_ALREADY_EXISTS,
        );
      }
      throw err;
    }
  }
}
