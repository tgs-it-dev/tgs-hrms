import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError } from 'typeorm';
import { Employee } from '../../entities/employee.entity';
import { User } from '../../entities/user.entity';
import { Designation } from '../../entities/designation.entity';
import { Role } from '../../entities/role.entity';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeeQueryDto } from './dto/employee-query.dto';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';


@Injectable()
export class EmployeeService {
  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Designation)
    private readonly designationRepo: Repository<Designation>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  private async validateDesignation(designation_id: string, tenant_id: string): Promise<Designation> {
    const designation = await this.designationRepo.findOne({
      where: { id: designation_id },
      relations: ['department'],
    });

    if (!designation) {
      throw new BadRequestException('Invalid designation ID');
    }

    if (designation.department.tenant_id !== tenant_id) {
      throw new BadRequestException('Designation does not belong to this tenant');
    }

    return designation;
  }


  async create(tenant_id: string, dto: CreateEmployeeDto) {
    await this.validateDesignation(dto.designation_id, tenant_id);

    const existingUser = await this.userRepo.findOne({ where: { email: dto.email, tenant_id } });
    if (existingUser) throw new ConflictException('User with this email already exists in the tenant.');

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
      role_id: employeeRole.id,
      tenant_id,
      reset_token: resetToken,
      reset_token_expiry: resetTokenExpiry,
    });

    const savedUser = await this.userRepo.save(user);

    const employee = this.employeeRepo.create({
      user_id: savedUser.id,
      designation_id: dto.designation_id,
    });

    try {
      const savedEmployee = await this.employeeRepo.save(employee);
      await this.sendPasswordResetEmail(dto.email, resetToken);
      return savedEmployee;
    } catch (err) {
      if (err instanceof QueryFailedError && (err as any).code === '23505') {
        throw new ConflictException('Employee already exists.');
      }
      throw err;
    }
  }




  async findAll(tenant_id: string, query: EmployeeQueryDto, page: number = 1) {
    const { department_id, designation_id } = query;

    const qb = this.employeeRepo.createQueryBuilder('employee')
      .leftJoinAndSelect('employee.user', 'user')
      .leftJoinAndSelect('employee.designation', 'designation')
      .leftJoinAndSelect('designation.department', 'department')
      .where('user.tenant_id = :tenant_id', { tenant_id });

    if (department_id) {
      qb.andWhere('designation.department_id = :department_id', { department_id });
    }
    if (designation_id) {
      qb.andWhere('employee.designation_id = :designation_id', { designation_id });
    }

    const limit = 25;
    const skip = (page - 1) * limit;
    return qb.skip(skip).take(limit).getMany();
  }

  async findOne(tenant_id: string, id: string) {
    const employee = await this.employeeRepo.findOne({
      where: { id },
      relations: ['user', 'designation', 'designation.department'],
    });

    if (!employee || employee.user.tenant_id !== tenant_id) {
      throw new NotFoundException('Employee not found');
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

  if (dto.email && dto.email !== user.email) {
    const existing = await this.userRepo.findOne({ where: { email: dto.email, tenant_id } });
    if (existing && existing.id !== user.id) {
      throw new ConflictException('User with this email already exists in the tenant.');
    }
  }

  let shouldSaveUser = false;
  if (dto.first_name !== undefined) { user.first_name = dto.first_name; shouldSaveUser = true; }
  if (dto.last_name !== undefined)  { user.last_name  = dto.last_name;  shouldSaveUser = true; }
  if (dto.email !== undefined)      { user.email      = dto.email;      shouldSaveUser = true; }
  if (dto.phone !== undefined)      { user.phone      = dto.phone;      shouldSaveUser = true; }
  if (dto.password) {
    user.password = await bcrypt.hash(dto.password, 10);
    shouldSaveUser = true;
  }

  try {
    if (shouldSaveUser) await this.userRepo.save(user);
    await this.employeeRepo.save(employee);
    return await this.employeeRepo.findOne({
      where: { id },
      relations: ['user', 'designation', 'designation.department'],
    });
  } catch (err) {
    if (err instanceof QueryFailedError && (err as any).code === '23505') {
      throw new ConflictException('Employee already exists.');
    }
    throw err;
  }
}
async remove(tenant_id: string, id: string): Promise<{ deleted: true; id: string }> {
    await this.findOne(tenant_id, id);
    await this.employeeRepo.delete(id);
    return { deleted: true, id };
  }

  private generateTemporaryPassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    return Array.from({ length: 12 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
  }

  private async sendPasswordResetEmail(email: string, resetToken: string) {
    const resetUrl = `${this.configService.get('FRONTEND_URL')}/reset-password?token=${resetToken}`;
    await this.mailerService.sendMail({
      to: email,
      subject: 'Welcome to HRMS - Set Your Password',
      template: 'employee-welcome',
      context: { resetUrl, email },
    });
  }


}
