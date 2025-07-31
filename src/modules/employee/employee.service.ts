import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError, Not } from 'typeorm';
import { Employee } from '../../entities/employee.entity';
import { Department } from '../../entities/department.entity';
import { Designation } from '../../entities/designation.entity';

import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeeQueryDto } from './dto/employee-query.dto';

@Injectable()
export class EmployeeService {
  constructor(
    @InjectRepository(Employee)
    private employeeRepo: Repository<Employee>,

    @InjectRepository(Department)
    private deptRepo: Repository<Department>,

    @InjectRepository(Designation)
    private designationRepo: Repository<Designation>,
  ) {}

  async validateDepartment(departmentId: string, tenantId: string) {
    const department = await this.deptRepo.findOneBy({ id: departmentId, tenantId });
    if (!department) {
      throw new BadRequestException('Invalid department for this tenant.');
    }
    return department;
  }

  async validateDesignation(designationId: string, departmentId: string) {
    const designation = await this.designationRepo.findOneBy({ id: designationId, departmentId });
    if (!designation) {
      throw new BadRequestException('Invalid designation for the selected department.');
    }
    return designation;
  }

  async validateEmailUniqueness(email: string, tenantId: string, excludeId?: string) {
    const normalizedEmail = email.toLowerCase();
    
    let existingEmployee;
    if (excludeId) {
      // Check for email uniqueness excluding the current employee
      existingEmployee = await this.employeeRepo.findOne({
        where: {
          email: normalizedEmail,
          tenantId,
          id: Not(excludeId)
        }
      });
    } else {
      // Check for email uniqueness (for new employees)
      existingEmployee = await this.employeeRepo.findOne({
        where: {
          email: normalizedEmail,
          tenantId
        }
      });
    }
    
    if (existingEmployee) {
      throw new ConflictException('Employee with this email already exists in this tenant.');
    }
  }

  async create(tenantId: string, dto: CreateEmployeeDto) {
    // Validate email uniqueness within tenant
    await this.validateEmailUniqueness(dto.email, tenantId);

    if (dto.departmentId) {
      await this.validateDepartment(dto.departmentId, tenantId);
    }
    if (dto.designationId && dto.departmentId) {
      await this.validateDesignation(dto.designationId, dto.departmentId);
    }

    const employee = this.employeeRepo.create({
      ...dto,
      email: dto.email.toLowerCase(), // Normalize email to lowercase
      tenantId,
    });

    try {
      return await this.employeeRepo.save(employee);
    } catch (err) {
      if (err instanceof QueryFailedError && (err as any).code === '23505') {
        throw new ConflictException('Employee with this email already exists.');
      }
      throw err;
    }
  }

  async findAll(tenantId: string, query: EmployeeQueryDto) {
    // Validate department_id if provided
    if (query.department_id) {
      await this.validateDepartment(query.department_id, tenantId);
    }

    // Validate designation_id if provided
    if (query.designation_id) {
      const designation = await this.designationRepo.findOne({
        where: { id: query.designation_id },
        relations: ['department']
      });
      
      if (!designation) {
        throw new BadRequestException('Invalid designation ID');
      }
      
      // Ensure designation belongs to the current tenant
      if (designation.department.tenantId !== tenantId) {
        throw new BadRequestException('Designation does not belong to this tenant');
      }
    }

    // Build where clause
    const whereClause: any = { tenantId };

    if (query.department_id) {
      whereClause.departmentId = query.department_id;
    }

    if (query.designation_id) {
      whereClause.designationId = query.designation_id;
    }

    return this.employeeRepo.find({
      where: whereClause,
      relations: ['department', 'designation'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const employee = await this.employeeRepo.findOne({
      where: { id, tenantId },
      relations: ['department', 'designation'],
    });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  async update(tenantId: string, id: string, dto: UpdateEmployeeDto) {
    const employee = await this.employeeRepo.findOneBy({ id, tenantId });
    if (!employee) throw new NotFoundException('Employee not found');

    // Validate email uniqueness if email is being updated
    if (dto.email && dto.email !== employee.email) {
      await this.validateEmailUniqueness(dto.email, tenantId, id);
    }

    // Validate department if provided
    if (dto.departmentId) {
      await this.validateDepartment(dto.departmentId, tenantId);
    }
    
    // Validate designation: either against new department or current employee department
    if (dto.designationId) {
      const departmentIdToUse = dto.departmentId || employee.departmentId;
      if (departmentIdToUse) {
        await this.validateDesignation(dto.designationId, departmentIdToUse);
      }
    }

    // Apply updates after validation
    Object.assign(employee, dto);
    
    // Normalize email if it's being updated
    if (dto.email) {
      employee.email = dto.email.toLowerCase();
    }

    try {
      return await this.employeeRepo.save(employee);
    } catch (err) {
      if (err instanceof QueryFailedError && (err as any).code === '23505') {
        throw new ConflictException('Employee with this email already exists.');
      }
      throw err;
    }
  }

  async remove(tenantId: string, id: string): Promise<{ deleted: true; id: string }> {
    await this.findOne(tenantId, id); 
    await this.employeeRepo.delete({ id, tenantId });
    return { deleted: true, id };
  }
}
