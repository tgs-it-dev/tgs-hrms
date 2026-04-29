import { Test, TestingModule } from '@nestjs/testing';
import { EmployeeService } from './services/employee.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Employee } from '../../entities/employee.entity';
import { User } from '../../entities/user.entity';
import { Department } from '../../entities/department.entity';
import { Designation } from '../../entities/designation.entity';
import { Role } from '../../entities/role.entity';
import { Team } from '../../entities/team.entity';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/employee.dto';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

const tenantId = '93ada9b3-fef5-4af3-ba65-035c833ea390';

const createDto: CreateEmployeeDto = {
  first_name: 'John',
  last_name: 'Doe',
  email: 'john@example.com',
  phone: '123456',
  designation_id: 'desig-uuid',
};

const updateDto: UpdateEmployeeDto = {
  first_name: 'John',
  last_name: 'Doe Updated',
  email: 'john.updated@example.com',
  phone: '123457',
  designation_id: 'desig-uuid-2',
};

const mockEmployeeRepo = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  findOneBy: jest.fn(),
  delete: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  })),
};

const mockUserRepo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
};

const mockDepartmentRepo = { findOneBy: jest.fn() };
const mockDesignationRepo = { findOne: jest.fn(), findOneBy: jest.fn() };
const mockRoleRepo = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
const mockTeamRepo = { findOne: jest.fn() };

const customRoleId = 'custom-role-uuid';
const createDtoWithRole: CreateEmployeeDto = {
  ...createDto,
  role_id: customRoleId,
};

describe('EmployeeService', () => {
  let service: EmployeeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeeService,
        { provide: getRepositoryToken(Employee), useValue: mockEmployeeRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(Designation), useValue: mockDesignationRepo },
        { provide: getRepositoryToken(Role), useValue: mockRoleRepo },
        { provide: getRepositoryToken(Team), useValue: mockTeamRepo },
        { provide: getRepositoryToken(Department), useValue: mockDepartmentRepo },
        { provide: MailerService, useValue: { sendMail: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = module.get<EmployeeService>(EmployeeService);

    mockRoleRepo.findOne.mockResolvedValue({ id: 'role-uuid', name: 'Employee' });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  
  describe('create', () => {
    it('should throw conflict if email exists in same tenant', async () => {
      mockDesignationRepo.findOne.mockResolvedValue({
        id: 'desig-uuid',
        department: { tenant_id: tenantId },
      });
      mockUserRepo.findOne.mockResolvedValue({
        id: 'existing-user',
        email: createDto.email,
        tenant_id: tenantId,
      });

      await expect(service.create(tenantId, "actor-user-id", createDto)).rejects.toThrow(
        'User with this email already exists in the tenant.'
      );
    });

    it('should allow creation if email exists in another tenant', async () => {
      mockDesignationRepo.findOne.mockResolvedValue({
        id: 'desig-uuid',
        department: { tenant_id: tenantId },
      });
      mockUserRepo.findOne.mockResolvedValue(null);

      mockUserRepo.create.mockReturnValue({ ...createDto, id: 'user-uuid' });
      mockUserRepo.save.mockResolvedValue({ ...createDto, id: 'user-uuid' });
      mockEmployeeRepo.create.mockReturnValue({
        id: 'emp-uuid',
        user_id: 'user-uuid',
        designation_id: 'desig-uuid',
      });
      mockEmployeeRepo.save.mockResolvedValue({
        id: 'emp-uuid',
        user_id: 'user-uuid',
        designation_id: 'desig-uuid',
      });

      const result = await service.create(tenantId, "actor-user-id", createDto);
      expect(result).toEqual({
        id: 'emp-uuid',
        user_id: 'user-uuid',
        designation_id: 'desig-uuid',
      });
    });

    it('should use provided role_id if given', async () => {
      mockDesignationRepo.findOne.mockResolvedValue({
        id: 'desig-uuid',
        department: { tenant_id: tenantId },
      });
      mockUserRepo.findOne.mockResolvedValue(null);
      mockRoleRepo.findOne.mockImplementation(({ where }) => {
        if (where && where.id === customRoleId) {
          return { id: customRoleId, name: 'HR Admin' };
        }
        return null;
      });
      mockUserRepo.create.mockReturnValue({ ...createDtoWithRole, id: 'user-uuid', role_id: customRoleId });
      mockUserRepo.save.mockResolvedValue({ ...createDtoWithRole, id: 'user-uuid', role_id: customRoleId });
      mockEmployeeRepo.create.mockReturnValue({
        id: 'emp-uuid',
        user_id: 'user-uuid',
        designation_id: 'desig-uuid',
      });
      mockEmployeeRepo.save.mockResolvedValue({
        id: 'emp-uuid',
        user_id: 'user-uuid',
        designation_id: 'desig-uuid',
      });
      const result = await service.create(tenantId, "actor-user-id", createDtoWithRole);
      expect(result).toEqual({
        id: 'emp-uuid',
        user_id: 'user-uuid',
        designation_id: 'desig-uuid',
      });
    });

    it('should throw NotFoundException if provided role_id does not exist', async () => {
      mockDesignationRepo.findOne.mockResolvedValue({
        id: 'desig-uuid',
        department: { tenant_id: tenantId },
      });
      mockUserRepo.findOne.mockResolvedValue(null);
      mockRoleRepo.findOne.mockResolvedValue(null); 
      await expect(
        service.create(tenantId, "actor-user-id", {
          ...createDto,
          role_id: "non-existent-role",
        }),
      ).rejects.toThrow("Specified role not found.");
    });
  });

  
  describe('update', () => {
    const existingEmployee = {
      id: 'emp-uuid',
      user: { id: 'user-uuid', email: 'old@example.com', tenant_id: tenantId },
      designation_id: 'desig-uuid',
      designation: { id: 'desig-uuid', department: { tenant_id: tenantId } },
    };

    beforeEach(() => {
      jest.clearAllMocks();
    
      mockEmployeeRepo.findOneBy.mockResolvedValue(existingEmployee);
      mockEmployeeRepo.findOne.mockImplementation(async ({ where }) => {
        if (where && where.id === existingEmployee.id) {
          return existingEmployee;
        }
        return null;
      });
    
      mockUserRepo.findOne.mockResolvedValue(null);
    
      mockDesignationRepo.findOneBy.mockImplementation(async ({ id }) => {
        if (id === 'desig-uuid-2') {
          return { id: 'desig-uuid-2', department: { tenant_id: tenantId } };
        }
        return null;
      });

      mockEmployeeRepo.save.mockImplementation(async (employee) => employee);
    });

    it('should throw conflict if new email exists in same tenant', async () => {
    
      mockUserRepo.findOne.mockResolvedValue({
        id: 'other-user',
        email: updateDto.email,
        tenant_id: tenantId,
      });
      const conflictDto = { ...updateDto };
      await expect(service.update(tenantId, existingEmployee.id, conflictDto)).rejects.toThrow(
        'User with this email already exists in the tenant.'
      );
    });

    it('should update employee successfully if no conflict', async () => {
  
      mockUserRepo.findOne.mockResolvedValue(null);
      const updatedData = {
        ...existingEmployee,
        designation_id: 'desig-uuid-2',
        designation: { id: 'desig-uuid-2', department: { tenant_id: tenantId } },
        user: {
          ...existingEmployee.user,
          email: updateDto.email,
          first_name: updateDto.first_name,
          last_name: updateDto.last_name,
          phone: updateDto.phone,
        },
      };
      
      mockEmployeeRepo.findOne.mockResolvedValue(updatedData);
      const result = await service.update(tenantId, existingEmployee.id, updateDto);
      expect(result).toEqual(updatedData);
      expect(mockEmployeeRepo.save).toHaveBeenCalledWith(updatedData);
    });
  });
});
