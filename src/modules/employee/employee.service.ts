import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError } from 'typeorm';
import { Employee } from '../../entities/employee.entity';
import { User } from '../../entities/user.entity';
import { Designation } from '../../entities/designation.entity';
import { Role } from '../../entities/role.entity';
import { Team } from '../../entities/team.entity';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeeQueryDto } from './dto/employee-query.dto';
import { ConfigService } from '@nestjs/config';
import { SendGridService } from '../auth/sendgrid.service';
import { InviteStatusService } from '../invite-status/invite-status.service';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

const GLOBAL = '00000000-0000-0000-0000-000000000000';
import { PaginationResponse } from '../../common/interfaces/pagination.interface';

@Injectable()
export class EmployeeService implements OnModuleInit {
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
    private readonly configService: ConfigService,
    private readonly sendGridService: SendGridService,
    private readonly inviteStatusService: InviteStatusService
  ) {}

  onModuleInit() {
    // Cron job logic moved to InviteStatusCronService
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

    // Check if designation belongs to the tenant or is GLOBAL
    if (
      designation.department.tenant_id !== tenant_id &&
      designation.department.tenant_id !== GLOBAL
    ) {
      throw new BadRequestException('Designation does not belong to your organization');
    }

    return designation;
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

  async createManager(tenant_id: string, dto: CreateEmployeeDto) {
    await this.validateDesignation(dto.designation_id, tenant_id);

    if (dto.team_id) {
      await this.validateTeam(dto.team_id, tenant_id);
    }

    const existingUser = await this.userRepo.findOne({ where: { email: dto.email, tenant_id } });
    if (existingUser)
      throw new ConflictException('User with this email already exists in the tenant.');

    const managerRole = await this.roleRepo.findOne({ where: { name: 'Manager' } });
    if (!managerRole)
      throw new NotFoundException('Manager role not found. Please create a manager role first.');

    const password = dto.password || this.generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(password, 10);

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date();
    resetTokenExpiry.setHours(resetTokenExpiry.getHours() + 24);

    const user = this.userRepo.create({
      email: dto.email,
      phone: dto.phone,
      password: hashedPassword,
      first_name: dto.first_name,
      last_name: dto.last_name,
      gender: dto.gender,
      role_id: managerRole.id,
      tenant_id,
      reset_token: resetToken,
      reset_token_expiry: resetTokenExpiry,
    });

    // Ensure atomicity: create user + employee and send email in one transaction
    try {
      return await this.userRepo.manager.transaction(async (manager) => {
        const userRepo = manager.getRepository(User);
        const employeeRepo = manager.getRepository(Employee);

        const savedUser = await userRepo.save(user);

        const employee = employeeRepo.create({
          user_id: savedUser.id,
          designation_id: dto.designation_id,
          team_id: dto.team_id || null,
          invite_status: 'Invite Sent',
        });

        const savedEmployee = await employeeRepo.save(employee);

        // Attempt to send email before committing. If this fails, transaction rolls back
        await this.sendPasswordResetEmail(dto.email, resetToken);

        return savedEmployee;
      });
    } catch (err) {
      if (err instanceof QueryFailedError && (err as any).code === '23505') {
        throw new ConflictException('Manager already exists.');
      }
      throw err;
    }
  }

  async create(tenant_id: string, dto: CreateEmployeeDto) {
    await this.validateDesignation(dto.designation_id, tenant_id);

    if (dto.team_id) {
      await this.validateTeam(dto.team_id, tenant_id);
    }

    const existingUser = await this.userRepo.findOne({ where: { email: dto.email, tenant_id } });
    if (existingUser)
      throw new ConflictException('User with this email already exists in the tenant.');

    const employeeRole = await this.roleRepo.findOne({ where: { name: 'Employee' } });
    if (!employeeRole) throw new NotFoundException('Employee role not found.');

    const password = dto.password || this.generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(password, 10);

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date();
    resetTokenExpiry.setHours(resetTokenExpiry.getHours() + 24);

    const user = this.userRepo.create({
      email: dto.email,
      phone: dto.phone,
      password: hashedPassword,
      first_name: dto.first_name,
      last_name: dto.last_name,
      gender: dto.gender,
      role_id: employeeRole.id,
      tenant_id,
      reset_token: resetToken,
      reset_token_expiry: resetTokenExpiry,
    });

    // Ensure atomicity: create user + employee and send email in one transaction
    try {
      return await this.userRepo.manager.transaction(async (manager) => {
        const userRepo = manager.getRepository(User);
        const employeeRepo = manager.getRepository(Employee);

        const savedUser = await userRepo.save(user);

        const employee = employeeRepo.create({
          user_id: savedUser.id,
          designation_id: dto.designation_id,
          team_id: dto.team_id || null,
          invite_status: 'Invite Sent',
        });

        const savedEmployee = await employeeRepo.save(employee);

        // Attempt to send email before committing. If this fails, transaction rolls back
        await this.sendPasswordResetEmail(dto.email, resetToken);

        return savedEmployee;
      });
    } catch (err) {
      if (err instanceof QueryFailedError && (err as any).code === '23505') {
        throw new ConflictException('Employee already exists.');
      }
      throw err;
    }
  }

  async findAll(tenant_id: string, query: EmployeeQueryDto, page: number) {
    const limit = 10;
    const skip = (page - 1) * limit;

    const qb = this.employeeRepo
      .createQueryBuilder('employee')
      .leftJoinAndSelect('employee.user', 'user')
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

    const [items, total] = await qb
      .orderBy('employee.created_at', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    // Apply lazy expiry for any 'Invite Sent' with expired token
    const now = new Date();
    for (const item of items) {
      if (item.invite_status === 'Invite Sent' && item.user?.reset_token_expiry && now > item.user.reset_token_expiry) {
        item.invite_status = 'Invite Expired';
        try {
          await this.employeeRepo.update(item.id, { invite_status: 'Invite Expired' });
        } catch {}
      }
    }

    const totalPages = Math.ceil(total / limit);

    return {
      items,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async findOne(tenant_id: string, id: string) {
    const employee = await this.employeeRepo.findOne({
      where: { id },
      relations: ['user', 'designation', 'designation.department', 'team'],
    });

    if (!employee || employee.user.tenant_id !== tenant_id) {
      throw new NotFoundException('Employee not found');
    }

    // Check and update invite status using the service
    const currentStatus = await this.inviteStatusService.getInviteStatus(employee.id);
    if (currentStatus && currentStatus !== employee.invite_status) {
      employee.invite_status = currentStatus as 'Invite Sent' | 'Invite Expired' | 'Joined';
    }

    return employee;
  }

  async update(tenant_id: string, id: string, dto: UpdateEmployeeDto) {
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
      if (dto.team_id) {
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

    try {
      if (shouldSaveUser) await this.userRepo.save(user);
      await this.employeeRepo.save(employee);
      return await this.employeeRepo.findOne({
        where: { id },
        relations: ['user', 'designation', 'designation.department', 'team'],
      });
    } catch (err) {
      if (err instanceof QueryFailedError && (err as any).code === '23505') {
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

      // Delete employee first to satisfy potential FK constraints referencing user via employee
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
      console.error(`Failed to send welcome email to ${email}:`, error);
      // Don't throw error to prevent transaction rollback
      console.warn('Email sending failed, but continuing with employee creation');
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
      .andWhere('employee.status = :status', { status: 'active' })
      .getCount();

    const inactiveEmployees = await this.employeeRepo
      .createQueryBuilder('employee')
      .leftJoin('employee.user', 'user')
      .where('user.tenant_id = :tenant_id', { tenant_id })
      .andWhere('employee.status = :status', { status: 'inactive' })
      .getCount();

    const male = await this.employeeRepo
      .createQueryBuilder('employee')
      .leftJoin('employee.user', 'user')
      .where('user.tenant_id = :tenant_id', { tenant_id })
      .andWhere('user.gender = :gender', { gender: 'male' })
      .andWhere('employee.status = :status', { status: 'active' })
      .getCount();

    const female = await this.employeeRepo
      .createQueryBuilder('employee')
      .leftJoin('employee.user', 'user')
      .where('user.tenant_id = :tenant_id', { tenant_id })
      .andWhere('user.gender = :gender', { gender: 'female' })
      .andWhere('employee.status = :status', { status: 'active' })
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

    // Return empty array if no employees found instead of throwing error
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
    // Find employee with user relation
    const employee = await this.employeeRepo.findOne({
      where: { id: employee_id },
      relations: ['user'],
    });
    if (!employee || employee.user.tenant_id !== tenant_id) {
      throw new NotFoundException('Employee not found for this tenant');
    }
    if (employee.invite_status !== 'Invite Expired') {
      throw new BadRequestException('Invite can only be resent if status is Invite Expired');
    }
    // Generate new reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date();
    resetTokenExpiry.setHours(resetTokenExpiry.getHours() + 24);
    employee.user.reset_token = resetToken;
    employee.user.reset_token_expiry = resetTokenExpiry;
    employee.invite_status = 'Invite Sent';
    await this.userRepo.save(employee.user);
    await this.employeeRepo.save(employee);
    // Resend invite email
    await this.sendPasswordResetEmail(employee.user.email, resetToken);
    return { message: 'Invite resent successfully' };
  }
}
