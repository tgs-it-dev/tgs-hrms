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

    const existingUser = await this.userRepo.findOne({
      where: { email: dto.email, tenant_id },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists in the tenant.');
    }

    const employeeRole = await this.roleRepo.findOne({
      where: { name: 'Employee' },
    });

    if (!employeeRole) {
      throw new NotFoundException('Employee role not found.');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = this.userRepo.create({
      email: dto.email,
      phone: dto.phone,
      password: hashedPassword,
      first_name: dto.first_name,
      last_name: dto.last_name,
      role_id: employeeRole.id,
      tenant_id,
    });

    const savedUser = await this.userRepo.save(user);

    const employee = this.employeeRepo.create({
      user_id: savedUser.id,
      designation_id: dto.designation_id,
    });

    try {
      return await this.employeeRepo.save(employee);
    } catch (err) {
      if (err instanceof QueryFailedError && (err as any).code === '23505') {
        throw new ConflictException('Employee already exists.');
      }
      throw err;
    }
  }

  async findAll(tenant_id: string, query: EmployeeQueryDto) {
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

    return qb.getMany();
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
    const employee = await this.employeeRepo.findOneBy({ id });
    if (!employee) throw new NotFoundException('Employee not found');

    const user = await this.userRepo.findOneBy({ id: employee.user_id });
    if (!user || user.tenant_id !== tenant_id) {
      throw new NotFoundException('Employee not found');
    }

    if (dto.designation_id) {
      await this.validateDesignation(dto.designation_id, tenant_id);
    }

    Object.assign(employee, dto);

    try {
      return await this.employeeRepo.save(employee);
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
}