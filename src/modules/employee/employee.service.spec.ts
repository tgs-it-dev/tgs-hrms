import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { EmployeeService } from './services/employee.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Employee } from '../../entities/employee.entity';
import { User } from '../../entities/user.entity';
import { Department } from '../../entities/department.entity';
import { Designation } from '../../entities/designation.entity';
import { Role } from '../../entities/role.entity';
import { Team } from '../../entities/team.entity';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/employee.dto';
import { InviteStatusService } from '../invite-status/invite-status.service';
import { EmployeeCreationService } from './services/employee-creation.service';
import { EmployeeValidationService } from './services/employee-validation.service';
import { EmployeeNotificationService } from './services/employee-notification.service';
import { EmployeeFileService } from './services/employee-file.service';

const tenantId = '93ada9b3-fef5-4af3-ba65-035c833ea390';
const actorUserId = '10000000-0000-0000-0000-000000000001';

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
  remove: jest.fn(),
  update: jest.fn(),
  manager: { transaction: jest.fn() },
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
  find: jest.fn().mockResolvedValue([]),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

const mockDepartmentRepo = { findOneBy: jest.fn() };
const mockDesignationRepo = { findOne: jest.fn(), findOneBy: jest.fn() };
const mockRoleRepo = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
const mockTeamRepo = { findOne: jest.fn() };

const mockInviteStatusService = { getInviteStatus: jest.fn() };

const mockEmployeeCreation = {
  create: jest.fn(),
  createAfterPayment: jest.fn(),
};

const mockNotification = {
  sendPasswordResetEmail: jest.fn(),
  sendNewEmployeeAnnouncementToTenant: jest.fn(),
  errorMessage: jest.fn((e: unknown) => (e instanceof Error ? e.message : String(e))),
};

const mockEmployeeFile = {
  uploadProfilePicture: jest.fn(),
  uploadCnicPicture: jest.fn(),
  uploadCnicBackPicture: jest.fn(),
  deleteProfilePicture: jest.fn(),
  deleteCnicPicture: jest.fn(),
  deleteCnicBackPicture: jest.fn(),
  getProfilePictureFile: jest.fn(),
  getCnicPictureFile: jest.fn(),
  getCnicBackPictureFile: jest.fn(),
};

describe('EmployeeService', () => {
  let service: EmployeeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeeService,
        EmployeeValidationService,
        { provide: EmployeeCreationService, useValue: mockEmployeeCreation },
        { provide: EmployeeNotificationService, useValue: mockNotification },
        { provide: EmployeeFileService, useValue: mockEmployeeFile },
        { provide: getRepositoryToken(Employee), useValue: mockEmployeeRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(Designation), useValue: mockDesignationRepo },
        { provide: getRepositoryToken(Role), useValue: mockRoleRepo },
        { provide: getRepositoryToken(Team), useValue: mockTeamRepo },
        { provide: getRepositoryToken(Department), useValue: mockDepartmentRepo },
        { provide: InviteStatusService, useValue: mockInviteStatusService },
      ],
    }).compile();

    service = module.get<EmployeeService>(EmployeeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should throw conflict if email exists in same tenant', async () => {
      mockEmployeeCreation.create.mockRejectedValue(
        new ConflictException('User with this email already exists in the tenant.'),
      );

      await expect(service.create(tenantId, actorUserId, createDto)).rejects.toThrow(
        'User with this email already exists in the tenant.',
      );
      expect(mockEmployeeCreation.create).toHaveBeenCalled();
    });

    it('should allow creation if email exists in another tenant', async () => {
      mockEmployeeCreation.create.mockResolvedValue({
        id: 'emp-uuid',
        user_id: 'user-uuid',
        designation_id: 'desig-uuid',
      });

      const result = await service.create(tenantId, actorUserId, createDto);
      expect(result).toEqual({
        id: 'emp-uuid',
        user_id: 'user-uuid',
        designation_id: 'desig-uuid',
      });
    });

    it('should use provided role_id if given', async () => {
      mockEmployeeCreation.create.mockResolvedValue({
        id: 'emp-uuid',
        user_id: 'user-uuid',
        designation_id: 'desig-uuid',
      });

      const createDtoWithRole: CreateEmployeeDto = {
        ...createDto,
        role_id: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
      };

      const result = await service.create(tenantId, actorUserId, createDtoWithRole);
      expect(result).toEqual({
        id: 'emp-uuid',
        user_id: 'user-uuid',
        designation_id: 'desig-uuid',
      });
    });

    it('should throw NotFoundException if provided role_id does not exist', async () => {
      mockEmployeeCreation.create.mockRejectedValue(new NotFoundException('Specified role not found.'));

      await expect(
        service.create(tenantId, actorUserId, {
          ...createDto,
          role_id: 'b2c3d4e5-f6a7-4b6c-9d0e-1f2a3b4c5d6e',
        }),
      ).rejects.toThrow('Specified role not found.');
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
      mockEmployeeRepo.findOne.mockImplementation((options: { where?: { id?: string } }) => {
        if (options?.where?.id === existingEmployee.id) {
          return Promise.resolve(existingEmployee);
        }
        return Promise.resolve(null);
      });

      mockUserRepo.findOne.mockResolvedValue(null);

      mockDesignationRepo.findOne.mockImplementation((opts: { where?: { id?: string } }) => {
        if (opts?.where?.id === 'desig-uuid-2') {
          return Promise.resolve({ id: 'desig-uuid-2', department: { tenant_id: tenantId } });
        }
        return Promise.resolve(null);
      });

      mockEmployeeRepo.save.mockImplementation((employee: Employee) => Promise.resolve(employee));
    });

    it('should throw conflict if new email exists in same tenant', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: 'other-user',
        email: updateDto.email,
        tenant_id: tenantId,
      });
      const conflictDto = { ...updateDto };
      await expect(service.update(tenantId, existingEmployee.id, conflictDto)).rejects.toThrow(
        'User with this email already exists in the tenant.',
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
