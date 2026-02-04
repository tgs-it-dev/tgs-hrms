import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Employee } from '../../../entities/employee.entity';
import { User } from '../../../entities/user.entity';
import { Designation } from '../../../entities/designation.entity';
import { Role } from '../../../entities/role.entity';
import { Team } from '../../../entities/team.entity';
import { CreateEmployeeDto, UpdateEmployeeDto, EmployeeQueryDto } from '../dto/employee.dto';
import { SendGridService } from '../../../common/utils/email';
import { InviteStatusService } from '../../invite-status/invite-status.service';
import { EmployeeFileUploadService } from './employee-file-upload.service';
import { EmployeeCreatedEvent } from '../../billing/events/employee-created.event';
import { BillingService } from '../../billing/services/billing.service';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

const GLOBAL = '00000000-0000-0000-0000-000000000000';
import { Logger } from '@nestjs/common';
import { InviteStatus, UserGender, EmployeeStatus } from '../../../common/constants/enums';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { getPostgresErrorCode } from '../../../common/types/database.types';
import { EmployeeSalaryService } from '../../payroll/services/employee-salary.service';
import { CreateEmployeeSalaryDto } from '../../payroll/dto/employee-salary.dto';
import { SalaryStatus } from '../../../common/constants/enums';

@Injectable()
export class EmployeeService implements OnModuleInit {
  private readonly logger = new Logger(EmployeeService.name);
  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Designation)
    private readonly designationRepo: Repository<Designation>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(Team)
    private readonly teamRepo: Repository<Team>,
    private readonly sendGridService: SendGridService,
    private readonly inviteStatusService: InviteStatusService,
    private readonly employeeFileUploadService: EmployeeFileUploadService,
    private readonly eventEmitter: EventEmitter2,
    private readonly billingService: BillingService,
    private readonly employeeSalaryService: EmployeeSalaryService,
  ) { }

  onModuleInit() {

  }

  private async validateDesignation(
    designation_id: string,
    tenant_id: string
  ): Promise<Designation> {
    const designation = await this.designationRepo.findOne({
      where: { id: designation_id },
      relations: ['department'],
    });

    if (!designation) {
      throw new BadRequestException('Invalid designation ID');
    }


    if (
      designation.department.tenant_id !== tenant_id &&
      designation.department.tenant_id !== GLOBAL
    ) {
      throw new BadRequestException('Designation does not belong to your organization');
    }

    return designation;
  }

  private validateUUID(value: string, fieldName: string): void {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      throw new BadRequestException(`${fieldName} must be a valid UUID`);
    }
  }

  private async validateTeam(team_id: string, tenant_id: string): Promise<Team> {
    const team = await this.teamRepo.findOne({
      where: { id: team_id },
      relations: ['manager'],
    });

    if (!team) {
      throw new BadRequestException('Invalid team ID');
    }

    if (team.manager.tenant_id !== tenant_id) {
      throw new BadRequestException('Team does not belong to this tenant');
    }

    return team;
  }

  async promoteToManager(tenant_id: string, id: string) {
    const employee = await this.findOne(tenant_id, id);
    const managerRole = await this.roleRepo.findOne({ where: { name: 'manager' } });
    if (!managerRole)
      throw new NotFoundException('Manager role not found. Please create a manager role first.');

    const user = employee.user;
    user.role_id = managerRole.id;

    try {
      await this.userRepo.save(user);
      return await this.employeeRepo.findOne({
        where: { id },
        relations: ['user', 'designation', 'designation.department', 'team'],
      });
    } catch (err) {
      throw new BadRequestException('Failed to promote employee to manager');
    }
  }

  async demoteToEmployee(tenant_id: string, id: string) {
    const employee = await this.findOne(tenant_id, id);
    const employeeRole = await this.roleRepo.findOne({ where: { name: 'Employee' } });
    if (!employeeRole) throw new NotFoundException('Employee role not found.');

    const user = employee.user;
    user.role_id = employeeRole.id;

    try {
      await this.userRepo.save(user);
      return await this.employeeRepo.findOne({
        where: { id },
        relations: ['user', 'designation', 'designation.department', 'team'],
      });
    } catch (err) {
      throw new BadRequestException('Failed to demote manager to employee');
    }
  }

  async createManager(tenant_id: string, createdByUserId: string, dto: CreateEmployeeDto, files?: {
    profile_picture?: Express.Multer.File[],
    cnic_picture?: Express.Multer.File[],
    cnic_back_picture?: Express.Multer.File[]
  }) {
    await this.validateDesignation(dto.designation_id, tenant_id);


    if (dto.team_id && dto.team_id !== null) {
      this.validateUUID(dto.team_id, 'team_id');
      await this.validateTeam(dto.team_id, tenant_id);
    }

    if (dto.role_id && dto.role_id !== null) {
      this.validateUUID(dto.role_id, 'role_id');
    }

    const existingUser = await this.userRepo.findOne({ where: { email: dto.email, tenant_id } });
    if (existingUser)
      throw new ConflictException('User with this email already exists in the tenant.');

    let managerRole;
    if (dto.role_id) {
      managerRole = await this.roleRepo.findOne({ where: { id: dto.role_id } });
      if (!managerRole) throw new NotFoundException('Specified role not found.');
    } else {
      managerRole = await this.roleRepo.findOne({ where: { name: 'Manager' } });
      if (!managerRole)
        throw new NotFoundException('Manager role not found. Please create a manager role first.');
    }

    const password = dto.password || this.generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(password, 10);

    const resetToken = crypto.randomBytes(32).toString('hex');
    // Hash the token before storing (similar to passwords)
    const hashedResetToken = await bcrypt.hash(resetToken, 10);
    const resetTokenExpiry = new Date();
    resetTokenExpiry.setHours(resetTokenExpiry.getHours() + 24);

    const user = this.userRepo.create({
      email: dto.email.toLowerCase(),
      phone: dto.phone,
      password: hashedPassword,
      first_name: dto.first_name,
      last_name: dto.last_name,
      gender: dto.gender ?? null,
      role_id: managerRole.id,
      tenant_id,
      reset_token: hashedResetToken,
      reset_token_expiry: resetTokenExpiry,
    });


    try {
      const result = await this.userRepo.manager.transaction(async (manager) => {
        const userRepo = manager.getRepository(User);
        const employeeRepo = manager.getRepository(Employee);

        const savedUser = await userRepo.save(user);

        const employee = employeeRepo.create({
          user_id: savedUser.id,
          designation_id: dto.designation_id,
          team_id: dto.team_id || null,
          invite_status: InviteStatus.INVITE_SENT,
          cnic_number: dto.cnic_number || null,
        });

        const savedEmployee = await employeeRepo.save(employee);
        return savedEmployee;
      });


      if (files) {
        try {
          const profileFile = files.profile_picture?.[0];
          if (profileFile) {
            const profilePictureUrl =
              await this.employeeFileUploadService.uploadProfilePicture(
                profileFile,
                result.id,
              );
            result.profile_picture = profilePictureUrl;

            const user = await this.userRepo.findOne({
              where: { id: result.user_id },
            });
            if (user) {
              user.profile_pic = profilePictureUrl;
              await this.userRepo.save(user);
            }
          }

          const cnicFile = files.cnic_picture?.[0];
          if (cnicFile) {
            const cnicPictureUrl =
              await this.employeeFileUploadService.uploadCnicPicture(
                cnicFile,
                result.id,
              );
            result.cnic_picture = cnicPictureUrl;
          }

          const cnicBackFile = files.cnic_back_picture?.[0];
          if (cnicBackFile) {
            const cnicBackPictureUrl =
              await this.employeeFileUploadService.uploadCnicBackPicture(
                cnicBackFile,
                result.id,
              );
            result.cnic_back_picture = cnicBackPictureUrl;
          }

          await this.employeeRepo.save(result);
        } catch (uploadError) {
          // If file upload fails, we must delete the employee to prevent partial creation
          // We also delete the linked user account
          await this.employeeRepo.delete(result.id);
          await this.userRepo.delete(result.user_id);
          throw uploadError; // Re-throw the error to notify the user
        }
      }


      await this.sendPasswordResetEmail(dto.email, resetToken);

      // Notify all other employees in the same tenant (tenant isolation)
      const newManagerUser = await this.userRepo.findOne({ where: { id: result.user_id }, select: ['id', 'email', 'first_name', 'last_name'] });
      if (newManagerUser) {
        const newManagerName = `${newManagerUser.first_name} ${newManagerUser.last_name}`.trim();
        await this.sendNewEmployeeAnnouncementToTenant(
          tenant_id,
          newManagerUser.id,
          newManagerName,
          newManagerUser.email,
        );
      }

      // Automatically create default salary structure for the new manager
      try {
        const defaults = await this.employeeSalaryService.getSalaryTemplateForTenant(tenant_id);
        const today = new Date().toISOString().split('T')[0];

        const salaryDto: CreateEmployeeSalaryDto = {
          employee_id: result.id,
          baseSalary: defaults.baseSalary,
          allowances: defaults.allowances,
          deductions: defaults.deductions,
          effectiveDate: today,
          status: SalaryStatus.ACTIVE,
          notes: 'Auto-created default salary structure on manager creation',
        };

        await this.employeeSalaryService.create(tenant_id, createdByUserId, salaryDto);
      } catch (salaryError) {
        this.logger.error(
          `Failed to create default salary for manager ${result.id}: ${salaryError instanceof Error ? salaryError.message : String(salaryError)
          }`,
        );
      }

      return result;
    } catch (err) {
      const errorCode = getPostgresErrorCode(err);
      if (errorCode === '23505') {
        throw new ConflictException('Manager already exists.');
      }
      throw err;
    }
  }

  async create(tenant_id: string, createdByUserId: string, dto: CreateEmployeeDto, files?: {
    profile_picture?: Express.Multer.File[],
    cnic_picture?: Express.Multer.File[],
    cnic_back_picture?: Express.Multer.File[]
  }) {
    await this.validateDesignation(dto.designation_id, tenant_id);


    if (dto.team_id && dto.team_id !== null) {
      this.validateUUID(dto.team_id, 'team_id');
      await this.validateTeam(dto.team_id, tenant_id);
    }

    if (dto.role_id && dto.role_id !== null) {
      this.validateUUID(dto.role_id, 'role_id');
    }

    const existingUser = await this.userRepo.findOne({ where: { email: dto.email, tenant_id } });
    if (existingUser)
      throw new ConflictException('User with this email already exists in the tenant.');

    let employeeRole;
    if (dto.role_name) {

      employeeRole = await this.roleRepo.findOne({ where: { name: dto.role_name } });
      if (!employeeRole) throw new NotFoundException(`Role with name '${dto.role_name}' not found.`);
    } else if (dto.role_id) {

      employeeRole = await this.roleRepo.findOne({ where: { id: dto.role_id } });
      if (!employeeRole) throw new NotFoundException('Specified role not found.');
    } else {

      employeeRole = await this.roleRepo.findOne({ where: { name: 'Employee' } });
      if (!employeeRole) throw new NotFoundException('Employee role not found.');
    }

    const password = dto.password || this.generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(password, 10);

    const resetToken = crypto.randomBytes(32).toString('hex');
    // Hash the token before storing (similar to passwords)
    const hashedResetToken = await bcrypt.hash(resetToken, 10);
    const resetTokenExpiry = new Date();
    resetTokenExpiry.setHours(resetTokenExpiry.getHours() + 24);

    const userData = {
      email: dto.email.toLowerCase(),
      phone: dto.phone,
      password: hashedPassword,
      first_name: dto.first_name,
      last_name: dto.last_name,
      gender: dto.gender ?? null,
      role_id: employeeRole.id,
      tenant_id,
      reset_token: hashedResetToken,
      reset_token_expiry: resetTokenExpiry,
    };


    try {
      const result = await this.userRepo.manager.transaction(async (manager) => {
        const userRepo = manager.getRepository(User);
        const employeeRepo = manager.getRepository(Employee);

        const user = userRepo.create(userData);
        const savedUser = await userRepo.save(user);

        const employee = employeeRepo.create({
          user_id: savedUser.id,
          designation_id: dto.designation_id,
          team_id: dto.team_id || null,
          invite_status: InviteStatus.INVITE_SENT,
          cnic_number: dto.cnic_number || null,
        });

        const savedEmployee = await employeeRepo.save(employee);
        return savedEmployee;
      });


      if (files) {
        try {
          const profileFile = files.profile_picture?.[0];
          if (profileFile) {
            const profilePictureUrl =
              await this.employeeFileUploadService.uploadProfilePicture(
                profileFile,
                result.id,
              );
            result.profile_picture = profilePictureUrl;

            const user = await this.userRepo.findOne({
              where: { id: result.user_id },
            });
            if (user) {
              user.profile_pic = profilePictureUrl;
              await this.userRepo.save(user);
            }
          }

          const cnicFile = files.cnic_picture?.[0];
          if (cnicFile) {
            const cnicPictureUrl =
              await this.employeeFileUploadService.uploadCnicPicture(
                cnicFile,
                result.id,
              );
            result.cnic_picture = cnicPictureUrl;
          }

          const cnicBackFile = files.cnic_back_picture?.[0];
          if (cnicBackFile) {
            const cnicBackPictureUrl =
              await this.employeeFileUploadService.uploadCnicBackPicture(
                cnicBackFile,
                result.id,
              );
            result.cnic_back_picture = cnicBackPictureUrl;
          }

          await this.employeeRepo.save(result);
        } catch (uploadError) {
          // If file upload fails, we must delete the employee to prevent partial creation
          // We also delete the linked user account
          await this.employeeRepo.delete(result.id);
          await this.userRepo.delete(result.user_id);
          throw uploadError; // Re-throw the error to notify the user
        }
      }

      // Process payment BEFORE sending invitation
      // Payment must succeed before employee invitation is sent
      const user = await this.userRepo.findOne({ where: { id: result.user_id } });
      if (!user) {
        throw new NotFoundException('User not found after employee creation');
      }

      const employeeName = `${user.first_name} ${user.last_name}`.trim();
      const event = new EmployeeCreatedEvent(
        tenant_id,
        result.id,
        user.email,
        employeeName,
      );

      // Process payment synchronously - if payment fails, return checkout URL
      try {
        await this.billingService.handleEmployeeCreated(event);
        this.logger.log(
          `Payment processed successfully for employee: ${result.id} (tenant: ${tenant_id})`,
        );
      } catch (paymentError) {
        const errorMessage = paymentError instanceof Error ? paymentError.message : String(paymentError);
        this.logger.error(
          `Payment failed for employee creation: ${result.id}. Error: ${errorMessage}`,
        );

        // If payment method is required, create checkout session and return URL
        if (errorMessage.includes('PAYMENT_METHOD_REQUIRED') ||
          errorMessage.includes('Payment method') ||
          errorMessage.includes('payment_intent_authentication_required')) {

          // Delete the employee since payment failed
          await this.employeeRepo.remove(result);
          await this.userRepo.remove(user);

          // Create checkout session for payment with full employee data
          try {
            const checkout = await this.billingService.createEmployeePaymentCheckout(
              tenant_id,
              {
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
              },
            );

            this.logger.log(
              `Checkout session created: ${checkout.checkoutSessionId}, URL: ${checkout.checkoutUrl}`,
            );

            // Return checkout URL instead of creating employee
            throw new BadRequestException({
              message: 'Payment method required. Please complete payment to create employee.',
              checkoutUrl: checkout.checkoutUrl,
              checkoutSessionId: checkout.checkoutSessionId,
              requiresPayment: true,
            });
          } catch (checkoutError) {
            const errorMessage = checkoutError instanceof Error ? checkoutError.message : String(checkoutError);
            const errorStack = checkoutError instanceof Error ? checkoutError.stack : undefined;
            this.logger.error(
              `Failed to create checkout session: ${errorMessage}`,
              errorStack,
            );

            // If it's already a BadRequestException, re-throw it as is
            if (checkoutError instanceof BadRequestException) {
              throw checkoutError;
            }

            // Otherwise, throw a new error with the actual error message
            throw new BadRequestException({
              message: `Payment method required but failed to create checkout session: ${errorMessage}`,
              originalError: errorMessage,
              requiresPayment: true,
            });
          }
        }

        // For other payment errors, delete employee and throw error
        await this.employeeRepo.remove(result);
        await this.userRepo.remove(user);

        throw new BadRequestException(
          `Payment processing failed: ${errorMessage}. Employee creation cannot be completed without successful payment.`,
        );
      }

      // Only send invitation if payment succeeds
      await this.sendPasswordResetEmail(dto.email, resetToken);

      // Notify all other employees in the same tenant (tenant isolation)
      await this.sendNewEmployeeAnnouncementToTenant(
        tenant_id,
        user.id,
        employeeName,
        user.email,
      );

      // Automatically create default salary structure for the new employee
      try {
        const defaults = await this.employeeSalaryService.getSalaryTemplateForTenant(tenant_id);
        const today = new Date().toISOString().split('T')[0];

        const salaryDto: CreateEmployeeSalaryDto = {
          employee_id: result.id,
          baseSalary: defaults.baseSalary,
          allowances: defaults.allowances,
          deductions: defaults.deductions,
          effectiveDate: today,
          status: SalaryStatus.ACTIVE,
          notes: 'Auto-created default salary structure on employee creation',
        };

        await this.employeeSalaryService.create(tenant_id, createdByUserId, salaryDto);
      } catch (salaryError) {
        this.logger.error(
          `Failed to create default salary for employee ${result.id}: ${salaryError instanceof Error ? salaryError.message : String(salaryError)
          }`,
        );
      }

      // Emit event for audit/logging purposes (payment already processed above)
      try {
        this.eventEmitter.emit('employee.created', event);
        this.logger.log(
          `Emitted employee.created event for employee: ${result.id} (tenant: ${tenant_id})`,
        );
      } catch (eventError) {
        // Log error but don't throw - event emission failures should not affect employee creation
        this.logger.error(
          `Failed to emit employee.created event: ${eventError instanceof Error ? eventError.message : String(eventError)}`,
        );
      }

      return result;
    } catch (err) {
      const errorCode = getPostgresErrorCode(err);
      if (errorCode === '23505') {
        throw new ConflictException('Employee already exists.');
      }
      throw err;
    }
  }

  /**
   * Creates employee after payment confirmation
   * This is called when payment is successful via checkout
   */
  async createAfterPayment(
    tenant_id: string,
    employeeData: {
      email: string;
      phone: string;
      first_name: string;
      last_name: string;
      designation_id: string;
      team_id?: string | null;
      role_id?: string | null;
      role_name?: string;
      gender?: string;
      cnic_number?: string;
      password?: string;
    },
  ) {
    // Convert to CreateEmployeeDto format
    const dto: CreateEmployeeDto = {
      email: employeeData.email,
      phone: employeeData.phone,
      first_name: employeeData.first_name,
      last_name: employeeData.last_name,
      designation_id: employeeData.designation_id,
      team_id: employeeData.team_id,
      role_id: employeeData.role_id,
      role_name: employeeData.role_name,
      gender: employeeData.gender as any,
      cnic_number: employeeData.cnic_number,
      password: employeeData.password,
    };

    // Create employee (payment already verified, so skip payment check)
    await this.validateDesignation(dto.designation_id, tenant_id);

    if (dto.team_id && dto.team_id !== null) {
      this.validateUUID(dto.team_id, 'team_id');
      await this.validateTeam(dto.team_id, tenant_id);
    }

    if (dto.role_id && dto.role_id !== null) {
      this.validateUUID(dto.role_id, 'role_id');
    }

    const existingUser = await this.userRepo.findOne({ where: { email: dto.email, tenant_id } });
    if (existingUser)
      throw new ConflictException('User with this email already exists in the tenant.');

    let employeeRole;
    if (dto.role_name) {
      employeeRole = await this.roleRepo.findOne({ where: { name: dto.role_name } });
      if (!employeeRole) throw new NotFoundException(`Role with name '${dto.role_name}' not found.`);
    } else if (dto.role_id) {
      employeeRole = await this.roleRepo.findOne({ where: { id: dto.role_id } });
      if (!employeeRole) throw new NotFoundException('Specified role not found.');
    } else {
      employeeRole = await this.roleRepo.findOne({ where: { name: 'Employee' } });
      if (!employeeRole) throw new NotFoundException('Employee role not found.');
    }

    const password = dto.password || this.generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(password, 10);

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedResetToken = await bcrypt.hash(resetToken, 10);
    const resetTokenExpiry = new Date();
    resetTokenExpiry.setHours(resetTokenExpiry.getHours() + 24);

    const userData = {
      email: dto.email.toLowerCase(),
      phone: dto.phone,
      password: hashedPassword,
      first_name: dto.first_name,
      last_name: dto.last_name,
      gender: dto.gender ?? null,
      role_id: employeeRole.id,
      tenant_id,
      reset_token: hashedResetToken,
      reset_token_expiry: resetTokenExpiry,
    };

    try {
      const result = await this.userRepo.manager.transaction(async (manager) => {
        const userRepo = manager.getRepository(User);
        const employeeRepo = manager.getRepository(Employee);

        const user = userRepo.create(userData);
        const savedUser = await userRepo.save(user);

        const employee = employeeRepo.create({
          user_id: savedUser.id,
          designation_id: dto.designation_id,
          team_id: dto.team_id || null,
          invite_status: InviteStatus.INVITE_SENT,
          cnic_number: dto.cnic_number || null,
        });

        const savedEmployee = await employeeRepo.save(employee);
        return savedEmployee;
      });

      // Send invitation email
      await this.sendPasswordResetEmail(dto.email, resetToken);

      // Notify all other employees in the same tenant (tenant isolation)
      const newEmployeeName = `${dto.first_name} ${dto.last_name}`.trim();
      await this.sendNewEmployeeAnnouncementToTenant(
        tenant_id,
        result.user_id,
        newEmployeeName,
        dto.email,
      );

      // Automatically create default salary structure for the new employee (created after payment)
      try {
        const defaults = await this.employeeSalaryService.getSalaryTemplateForTenant(tenant_id);
        const today = new Date().toISOString().split('T')[0];

        const salaryDto: CreateEmployeeSalaryDto = {
          employee_id: result.id,
          baseSalary: defaults.baseSalary,
          allowances: defaults.allowances,
          deductions: defaults.deductions,
          effectiveDate: today,
          status: SalaryStatus.ACTIVE,
          notes: 'Auto-created default salary structure on employee creation after payment',
        };

        // Use the newly created employee's linked user as the actor for auditing purposes
        await this.employeeSalaryService.create(tenant_id, result.user_id, salaryDto);
      } catch (salaryError) {
        this.logger.error(
          `Failed to create default salary for employee ${result.id} after payment: ${salaryError instanceof Error ? salaryError.message : String(salaryError)
          }`,
        );
      }

      // Note: Event is NOT emitted here because payment was already processed in confirmEmployeePayment
      // This prevents duplicate billing transaction creation

      this.logger.log(
        `Employee created successfully after payment: ${result.id} (tenant: ${tenant_id})`,
      );

      return result;
    } catch (err) {
      const errorCode = getPostgresErrorCode(err);
      if (errorCode === '23505') {
        throw new ConflictException('Employee already exists.');
      }
      throw err;
    }
  }

  async findAll(tenant_id: string, query: EmployeeQueryDto, page: number) {
    const limit = 25;
    const skip = (page - 1) * limit;

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

    // Add search functionality
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

    const [items, total] = await qb
      .orderBy('employee.created_at', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();


    const now = new Date();
    for (const item of items) {
      if (item.invite_status === InviteStatus.INVITE_SENT && item.user?.reset_token_expiry && now > item.user.reset_token_expiry) {
        item.invite_status = InviteStatus.INVITE_EXPIRED;
        try {
          await this.employeeRepo.update(item.id, { invite_status: InviteStatus.INVITE_EXPIRED });
        } catch { }
      }
    }

    const totalPages = Math.ceil(total / limit);

    return {
      items: items.map(employee => ({
        ...employee,
        role_name: employee.user?.role?.name || null,
      })),
      total,
      page,
      limit,
      totalPages,
    };
  }

  async findOne(tenant_id: string, id: string) {
    const employee = await this.employeeRepo.findOne({
      where: { id },
      relations: ['user', 'user.role', 'designation', 'designation.department', 'team'],
    });

    if (!employee || employee.user.tenant_id !== tenant_id) {
      throw new NotFoundException('Employee not found');
    }


    const currentStatus = await this.inviteStatusService.getInviteStatus(employee.id);
    if (currentStatus && currentStatus !== employee.invite_status) {
      employee.invite_status = currentStatus as InviteStatus;
    }

    return {
      ...employee,
      role_name: employee.user?.role?.name || null,
    };
  }

  async update(tenant_id: string, id: string, dto: UpdateEmployeeDto, files?: {
    profile_picture?: Express.Multer.File[],
    cnic_picture?: Express.Multer.File[],
    cnic_back_picture?: Express.Multer.File[]
  }) {
    const employee = await this.employeeRepo.findOne({
      where: { id },
      relations: ['user', 'designation', 'designation.department'],
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const user = employee.user;
    if (!user || user.tenant_id !== tenant_id) {
      throw new NotFoundException('Employee not found');
    }

    if (dto.designation_id) {
      const newDesignation = await this.validateDesignation(dto.designation_id, tenant_id);
      employee.designation_id = newDesignation.id;
      employee.designation = newDesignation;
    }

    if (dto.team_id !== undefined) {
      if (dto.team_id && dto.team_id !== null) {
        this.validateUUID(dto.team_id, 'team_id');
        await this.validateTeam(dto.team_id, tenant_id);
        employee.team_id = dto.team_id;
      } else {
        employee.team_id = null;
      }
    }

    if (dto.email && dto.email !== user.email) {
      const existing = await this.userRepo.findOne({ where: { email: dto.email, tenant_id } });
      if (existing && existing.id !== user.id) {
        throw new ConflictException('User with this email already exists in the tenant.');
      }
    }

    let shouldSaveUser = false;
    if (dto.role_name) {

      const newRole = await this.roleRepo.findOne({ where: { name: dto.role_name } });
      if (!newRole) throw new NotFoundException(`Role with name '${dto.role_name}' not found.`);
      user.role_id = newRole.id;
      shouldSaveUser = true;
    } else if (dto.role_id !== undefined) {
      if (dto.role_id && dto.role_id !== null) {
        this.validateUUID(dto.role_id, 'role_id');
        const newRole = await this.roleRepo.findOne({ where: { id: dto.role_id } });
        if (!newRole) throw new NotFoundException('Specified role not found.');
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
      user.password = await bcrypt.hash(dto.password, 10);
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
            await this.employeeFileUploadService.deleteProfilePicture(user.profile_pic);
            this.logger.log('Old profile picture deleted successfully');
          } catch (error) {
            this.logger.warn('Failed to delete old profile picture:', error);
          }
        }

        try {
          this.logger.log('Uploading new profile picture for employee:', employee.id);
          const profilePictureUrl = await this.employeeFileUploadService.uploadProfilePicture(
            files.profile_picture[0],
            employee.id,
          );
          this.logger.log('Profile picture uploaded successfully:', profilePictureUrl);
          user.profile_pic = profilePictureUrl;
          employee.profile_picture = profilePictureUrl;
          shouldSaveUser = true;
        } catch (error) {
          this.logger.error('Failed to upload profile picture:', error);
          throw new BadRequestException('Failed to upload profile picture');
        }
      }

      if (files.cnic_picture?.[0]) {
        if (employee.cnic_picture) {
          try {
            this.logger.log('Deleting old CNIC picture:', employee.cnic_picture);
            await this.employeeFileUploadService.deleteCnicPicture(employee.cnic_picture);
            this.logger.log('Old CNIC picture deleted successfully');
          } catch (error) {
            this.logger.warn('Failed to delete old CNIC picture:', error);
          }
        }

        try {
          this.logger.log('Uploading new CNIC picture for employee:', employee.id);
          const cnicPictureUrl = await this.employeeFileUploadService.uploadCnicPicture(
            files.cnic_picture[0],
            employee.id,
          );
          this.logger.log('CNIC picture uploaded successfully:', cnicPictureUrl);
          employee.cnic_picture = cnicPictureUrl;
        } catch (error) {
          this.logger.error('Failed to upload CNIC picture:', error);
          throw new BadRequestException('Failed to upload CNIC picture');
        }
      }

      if (files.cnic_back_picture?.[0]) {
        if (employee.cnic_back_picture) {
          try {
            this.logger.log('Deleting old CNIC back picture:', employee.cnic_back_picture);
            await this.employeeFileUploadService.deleteCnicBackPicture(employee.cnic_back_picture);
            this.logger.log('Old CNIC back picture deleted successfully');
          } catch (error) {
            this.logger.warn('Failed to delete old CNIC back picture:', error);
          }
        }

        try {
          this.logger.log('Uploading new CNIC back picture for employee:', employee.id);
          const cnicBackPictureUrl = await this.employeeFileUploadService.uploadCnicBackPicture(
            files.cnic_back_picture[0],
            employee.id,
          );
          this.logger.log('CNIC back picture uploaded successfully:', cnicBackPictureUrl);
          employee.cnic_back_picture = cnicBackPictureUrl;
        } catch (error) {
          this.logger.error('Failed to upload CNIC back picture:', error);
          throw new BadRequestException('Failed to upload CNIC back picture');
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
        throw new ConflictException('Employee already exists.');
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
      throw new NotFoundException('Employee not found');
    }

    await this.employeeRepo.manager.transaction(async (manager) => {
      const employeeRepo = manager.getRepository(Employee);
      const userRepo = manager.getRepository(User);


      await employeeRepo.delete(employee.id);
      await userRepo.delete(employee.user.id);
    });

    return { deleted: true, id };
  }

  private generateTemporaryPassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    return Array.from({ length: 12 }, () =>
      chars.charAt(Math.floor(Math.random() * chars.length))
    ).join('');
  }

  private async sendPasswordResetEmail(email: string, resetToken: string) {
    try {
      await this.sendGridService.sendWelcomeEmail(email, resetToken);
    } catch (error) {
      this.logger.error(`Failed to send welcome email to ${email}: ${String((error as any)?.message || error)}`);

      this.logger.warn('Email sending failed, but continuing with employee creation');
    }
  }

  /**
   * Sends "New team member joined" email to all other users in the same tenant.
   * Tenant isolation: only users with tenant_id = tenant_id receive the email; the new employee is excluded.
   */
  private async sendNewEmployeeAnnouncementToTenant(
    tenant_id: string,
    excludeUserId: string,
    newEmployeeName: string,
    newEmployeeEmail: string,
  ): Promise<void> {
    try {
      const tenantUsers = await this.userRepo.find({
        where: { tenant_id },
        select: ['id', 'email'],
      });
      const recipients = tenantUsers.filter((u) => u.id !== excludeUserId && u.email);
      if (recipients.length === 0) {
        this.logger.log(`No other tenant users to notify for new employee (tenant: ${tenant_id})`);
        return;
      }
      for (const recipient of recipients) {
        try {
          await this.sendGridService.sendNewTeamMemberAnnouncementEmail(
            recipient.email,
            newEmployeeName,
            newEmployeeEmail,
          );
        } catch (err) {
          this.logger.error(
            `Failed to send new employee announcement to ${recipient.email}: ${String((err as any)?.message || err)}`,
          );
          // Continue with other recipients; do not throw
        }
      }
      this.logger.log(
        `New employee announcement sent to ${recipients.length} tenant member(s) (tenant: ${tenant_id})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send new employee announcement to tenant ${tenant_id}: ${String((error as any)?.message || error)}`,
      );
      // Do not throw - announcement failure should not affect employee creation
    }
  }

  async getGenderPercentage(tenant_id: string): Promise<{
    male: number;
    female: number;
    total: number;
    activeEmployees: number;
    inactiveEmployees: number;
  }> {
    const totalEmployees = await this.employeeRepo
      .createQueryBuilder('employee')
      .leftJoin('employee.user', 'user')
      .where('user.tenant_id = :tenant_id', { tenant_id })
      .getCount();

    const activeEmployees = await this.employeeRepo
      .createQueryBuilder('employee')
      .leftJoin('employee.user', 'user')
      .where('user.tenant_id = :tenant_id', { tenant_id })
      .andWhere('employee.status = :status', { status: EmployeeStatus.ACTIVE })
      .getCount();

    const inactiveEmployees = await this.employeeRepo
      .createQueryBuilder('employee')
      .leftJoin('employee.user', 'user')
      .where('user.tenant_id = :tenant_id', { tenant_id })
      .andWhere('employee.status = :status', { status: EmployeeStatus.INACTIVE })
      .getCount();

    const male = await this.employeeRepo
      .createQueryBuilder('employee')
      .leftJoin('employee.user', 'user')
      .where('user.tenant_id = :tenant_id', { tenant_id })
      .andWhere('user.gender = :gender', { gender: UserGender.MALE })
      .andWhere('employee.status = :status', { status: EmployeeStatus.ACTIVE })
      .getCount();

    const female = await this.employeeRepo
      .createQueryBuilder('employee')
      .leftJoin('employee.user', 'user')
      .where('user.tenant_id = :tenant_id', { tenant_id })
      .andWhere('user.gender = :gender', { gender: UserGender.FEMALE })
      .andWhere('employee.status = :status', { status: EmployeeStatus.ACTIVE })
      .getCount();

    return {
      male,
      female,
      total: totalEmployees,
      activeEmployees,
      inactiveEmployees,
    };
  }

  async getEmployeeJoiningReport(tenant_id: string): Promise<any[]> {
    const results = await this.employeeRepo
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
      month: parseInt(entry.month),
      year: parseInt(entry.year),
      total: parseInt(entry.total),
    }));
  }

  async refreshInviteStatus(tenant_id: string, employee_id: string) {

    const employee = await this.employeeRepo.findOne({
      where: { id: employee_id },
      relations: ['user'],
    });
    if (!employee || employee.user.tenant_id !== tenant_id) {
      throw new NotFoundException('Employee not found for this tenant');
    }
    if (employee.invite_status !== InviteStatus.INVITE_EXPIRED) {
      throw new BadRequestException('Invite can only be resent if status is Invite Expired');
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    // Hash the token before storing (similar to passwords)
    const hashedResetToken = await bcrypt.hash(resetToken, 10);
    const resetTokenExpiry = new Date();
    resetTokenExpiry.setHours(resetTokenExpiry.getHours() + 24);
    employee.user.reset_token = hashedResetToken;
    employee.user.reset_token_expiry = resetTokenExpiry;
    employee.invite_status = InviteStatus.INVITE_SENT;
    await this.userRepo.save(employee.user);
    await this.employeeRepo.save(employee);

    await this.sendPasswordResetEmail(employee.user.email, resetToken);
    return { message: 'Invite resent successfully' };
  }

  async getProfilePictureFile(tenant_id: string, employee_id: string, res: Response) {
    const employee = await this.employeeRepo.findOne({
      where: { id: employee_id },
      relations: ['user'],
    });

    if (!employee || employee.user.tenant_id !== tenant_id) {
      throw new NotFoundException('Employee not found');
    }

    let imagePath: string | null = null;


    if (employee.profile_picture) {
      imagePath = employee.profile_picture;
    }

    else if (employee.user.profile_pic) {
      imagePath = employee.user.profile_pic;
    }

    if (!imagePath) {
      throw new NotFoundException('No profile picture available');
    }


    const fileName = imagePath.split('/').pop();
    if (!fileName) {
      throw new NotFoundException('Invalid image path');
    }

    const filePath = path.join(process.cwd(), 'public', 'profile-pictures', fileName);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Profile picture file not found');
    }


    const ext = path.extname(fileName).toLowerCase();
    const contentType = this.getContentType(ext);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  }

  async getCnicPictureFile(tenant_id: string, employee_id: string, res: Response) {
    const employee = await this.employeeRepo.findOne({
      where: { id: employee_id },
      relations: ['user'],
    });

    if (!employee || employee.user.tenant_id !== tenant_id) {
      throw new NotFoundException('Employee not found');
    }

    if (!employee.cnic_picture) {
      throw new NotFoundException('No CNIC picture available');
    }


    const fileName = employee.cnic_picture.split('/').pop();
    if (!fileName) {
      throw new NotFoundException('Invalid CNIC image path');
    }

    const filePath = path.join(process.cwd(), 'public', 'cnic-pictures', fileName);


    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('CNIC picture file not found');
    }


    const ext = path.extname(fileName).toLowerCase();
    const contentType = this.getContentType(ext);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year


    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  }

  async getCnicBackPictureFile(tenant_id: string, employee_id: string, res: Response) {
    const employee = await this.employeeRepo.findOne({
      where: { id: employee_id },
      relations: ['user'],
    });

    if (!employee || employee.user.tenant_id !== tenant_id) {
      throw new NotFoundException('Employee not found');
    }

    if (!employee.cnic_back_picture) {
      throw new NotFoundException('No CNIC back picture available');
    }


    const fileName = employee.cnic_back_picture.split('/').pop();
    if (!fileName) {
      throw new NotFoundException('Invalid CNIC back image path');
    }

    const filePath = path.join(process.cwd(), 'public', 'cnic-back-pictures', fileName);


    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('CNIC back picture file not found');
    }


    const ext = path.extname(fileName).toLowerCase();
    const contentType = this.getContentType(ext);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year


    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  }


  private getContentType(ext: string): string {
    const contentTypes: { [key: string]: string } = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
      '.svg': 'image/svg+xml',
    };

    return contentTypes[ext] || 'application/octet-stream';
  }

  async getAllEmployeesForSystemAdmin(tenantId?: string) {
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

    return items;
  }
}
