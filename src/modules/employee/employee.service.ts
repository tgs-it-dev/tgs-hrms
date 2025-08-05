import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError, Not } from 'typeorm';
import { Employee } from '../../entities/employee.entity';
import { User } from '../../entities/user.entity';
import { Designation } from '../../entities/designation.entity';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeeQueryDto } from './dto/employee-query.dto';

@Injectable()
export class EmployeeService {
  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Designation)
    private readonly designationRepo: Repository<Designation>,
  ) {}

  private async validateUser(user_id: string, tenant_id: string): Promise<User> {
    const user = await this.userRepo.findOneBy({ id: user_id, tenant_id });
    if (!user) {
      throw new BadRequestException('Invalid user for this tenant.');
    }
    return user;
  }

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

  private async ensureEmployeeIsUnique(user_id: string, tenant_id: string, exclude_id?: string) {
    const employee = await this.employeeRepo.findOne({
      where: exclude_id
        ? { user_id, id: Not(exclude_id) }
        : { user_id },
      relations: ['user'],
    });

    if (employee && employee.user.tenant_id === tenant_id) {
      throw new ConflictException('User is already an employee in this tenant.');
    }
  }

  async create(tenant_id: string, dto: CreateEmployeeDto) {
    await this.validateUser(dto.user_id, tenant_id);
    await this.validateDesignation(dto.designation_id, tenant_id);
    await this.ensureEmployeeIsUnique(dto.user_id, tenant_id);

    const employee = this.employeeRepo.create({
      user_id: dto.user_id,
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
    if (query.designation_id) {
      await this.validateDesignation(query.designation_id, tenant_id);
    }

    const whereClause: any = {};
    if (query.designation_id) {
      whereClause.designation_id = query.designation_id;
    }

    const employees = await this.employeeRepo.find({
      where: whereClause,
      relations: ['user', 'designation', 'designation.department'],
    });

    return employees.filter((e) => e.user.tenant_id === tenant_id);
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
