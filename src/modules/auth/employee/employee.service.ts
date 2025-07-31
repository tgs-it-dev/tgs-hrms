import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from '../../../entities/employee.entity';
import { Department } from '../../../entities/department.entity';
import { Designation } from '../../../entities/designation.entity';

import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

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

  async create(tenantId: string, dto: CreateEmployeeDto) {
    if (dto.departmentId) {
      await this.validateDepartment(dto.departmentId, tenantId);
    }
    if (dto.designationId && dto.departmentId) {
      await this.validateDesignation(dto.designationId, dto.departmentId);
    }

    const employee = this.employeeRepo.create({
      ...dto,
      tenantId,
    });

    return await this.employeeRepo.save(employee);
  }

  async findAll(tenantId: string) {
    const employees = await this.employeeRepo.find({
      where: { tenantId },
      relations: ['department', 'designation'],
      order: { createdAt: 'DESC' },
    });

    return employees.map((employee) => ({
      ...employee,
      department: employee.department
        ? { id: employee.department.id, name: employee.department.name }
        : null,
      designation: employee.designation
        ? { id: employee.designation.id, title: employee.designation.title }
        : null,
    }));
  }

  async findOne(tenantId: string, id: string) {
    const employee = await this.employeeRepo.findOne({
      where: { id, tenantId },
      relations: ['department', 'designation'],
    });
    if (!employee) throw new NotFoundException('Employee not found');

    return {
      ...employee,
      department: employee.department
        ? { id: employee.department.id, name: employee.department.name }
        : null,
      designation: employee.designation
        ? { id: employee.designation.id, title: employee.designation.title }
        : null,
    };
  }

  async update(tenantId: string, id: string, dto: UpdateEmployeeDto) {
    const employee = await this.employeeRepo.findOneBy({ id, tenantId });
    if (!employee) throw new NotFoundException('Employee not found');

    if (dto.departmentId) {
      await this.validateDepartment(dto.departmentId, tenantId);
    }
    if (dto.designationId && dto.departmentId) {
      await this.validateDesignation(dto.designationId, dto.departmentId);
    }

    Object.assign(employee, dto);
    return await this.employeeRepo.save(employee);
  }

  async remove(tenantId: string, id: string): Promise<{ deleted: true; id: string }> {
    await this.findOne(tenantId, id);
    await this.employeeRepo.delete({ id, tenantId });
    return { deleted: true, id };
  }
}
