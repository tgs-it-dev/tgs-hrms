import { Test, TestingModule } from '@nestjs/testing';
import { EmployeeService } from '../../../src/modules/auth/employee/employee.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Employee } from '../../../src/entities/employee.entity';
import { Department } from '../../../src/entities/department.entity';
import { Designation } from '../../../src/entities/designation.entity';

const mockEmployeeRepo = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  findOneBy: jest.fn(),
  delete: jest.fn(),
};

const mockDepartmentRepo = {
  findOneBy: jest.fn(),
};

const mockDesignationRepo = {
  findOneBy: jest.fn(),
};

const createDto = {
  name: 'John Doe',
  email: 'john@example.com',
  phone: '123456',
  departmentId: 'dept-uuid',
  designationId: 'desig-uuid',
};

const tenantId = 'tenant-uuid';

describe('EmployeeService', () => {
  let service: EmployeeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeeService,
        {
          provide: getRepositoryToken(Employee),
          useValue: mockEmployeeRepo,
        },
        {
          provide: getRepositoryToken(Department),
          useValue: mockDepartmentRepo,
        },
        {
          provide: getRepositoryToken(Designation),
          useValue: mockDesignationRepo,
        },
      ],
    }).compile();

    service = module.get<EmployeeService>(EmployeeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should throw error if department not found for tenant', async () => {
    mockDepartmentRepo.findOneBy.mockResolvedValue(undefined);

    await expect(service.create(tenantId, createDto)).rejects.toThrow(
      'Invalid department for this tenant.',
    );
  });

  it('should throw error if designation does not belong to department', async () => {
    mockDepartmentRepo.findOneBy.mockResolvedValue({ id: 'dept-uuid', tenantId });
    mockDesignationRepo.findOneBy.mockResolvedValue(undefined);

    await expect(service.create(tenantId, createDto)).rejects.toThrow(
      'Invalid designation for the selected department.',
    );
  });

  it('should create employee successfully if validations pass', async () => {
    mockDepartmentRepo.findOneBy.mockResolvedValue({ id: 'dept-uuid', tenantId });
    mockDesignationRepo.findOneBy.mockResolvedValue({ id: 'desig-uuid', departmentId: 'dept-uuid' });

    const mockEmployee = { id: 'emp-uuid', ...createDto, tenantId };
    mockEmployeeRepo.create.mockReturnValue(mockEmployee);
    mockEmployeeRepo.save.mockResolvedValue(mockEmployee);

    const result = await service.create(tenantId, createDto);
    expect(result).toEqual(mockEmployee);
    expect(mockEmployeeRepo.create).toHaveBeenCalledWith({ ...createDto, tenantId });
    expect(mockEmployeeRepo.save).toHaveBeenCalledWith(mockEmployee);
  });
});
