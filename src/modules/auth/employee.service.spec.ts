import { Test, TestingModule } from '@nestjs/testing';
import { EmployeeService } from '../../../src/modules/auth/employee/employee.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Employee } from '../../../src/entities/employee.entity';
import { Department } from '../../../src/entities/department.entity';
import { Designation } from '../../../src/entities/designation.entity';
import { EmployeeQueryDto } from '../../../src/modules/auth/employee/dto/employee-query.dto';
import { CreateEmployeeDto } from '../../../src/modules/auth/employee/dto/create-employee.dto';
import { UpdateEmployeeDto } from '../../../src/modules/auth/employee/dto/update-employee.dto';
import { ConflictException } from '@nestjs/common';
import { Not } from 'typeorm';

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
  findOne: jest.fn(),
};

const createDto: CreateEmployeeDto = {
  name: 'John Doe',
  email: 'john@example.com',
  phone: '123456',
  departmentId: 'dept-uuid',
  designationId: 'desig-uuid',
};

const updateDto: UpdateEmployeeDto = {
  name: 'John Doe Updated',
  email: 'john.updated@example.com',
  phone: '123457',
  departmentId: 'dept-uuid-2',
  designationId: 'desig-uuid-2',
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

  describe('create', () => {
    it('should throw error if email already exists in tenant', async () => {
      mockEmployeeRepo.findOne.mockResolvedValue({ id: 'existing-emp', email: 'john@example.com' });

      await expect(service.create(tenantId, createDto)).rejects.toThrow(
        'Employee with this email already exists in this tenant.',
      );
    });

    it('should throw error if department not found for tenant', async () => {
      mockEmployeeRepo.findOne.mockResolvedValue(undefined); // Email is unique
      mockDepartmentRepo.findOneBy.mockResolvedValue(undefined);

      await expect(service.create(tenantId, createDto)).rejects.toThrow(
        'Invalid department for this tenant.',
      );
    });

    it('should throw error if designation does not belong to department', async () => {
      mockEmployeeRepo.findOne.mockResolvedValue(undefined); // Email is unique
      mockDepartmentRepo.findOneBy.mockResolvedValue({ id: 'dept-uuid', tenantId });
      mockDesignationRepo.findOneBy.mockResolvedValue(undefined);

      await expect(service.create(tenantId, createDto)).rejects.toThrow(
        'Invalid designation for the selected department.',
      );
    });

    it('should create employee successfully if validations pass', async () => {
      mockEmployeeRepo.findOne.mockResolvedValue(undefined); // Email is unique
      mockDepartmentRepo.findOneBy.mockResolvedValue({ id: 'dept-uuid', tenantId });
      mockDesignationRepo.findOneBy.mockResolvedValue({ id: 'desig-uuid', departmentId: 'dept-uuid' });

      const mockEmployee = { id: 'emp-uuid', ...createDto, tenantId };
      mockEmployeeRepo.create.mockReturnValue(mockEmployee);
      mockEmployeeRepo.save.mockResolvedValue(mockEmployee);

      const result = await service.create(tenantId, createDto);
      expect(result).toEqual(mockEmployee);
      expect(mockEmployeeRepo.create).toHaveBeenCalledWith({ 
        ...createDto, 
        email: 'john@example.com', // Should be normalized to lowercase
        tenantId 
      });
      expect(mockEmployeeRepo.save).toHaveBeenCalledWith(mockEmployee);
    });

    it('should create employee without department and designation', async () => {
      const dtoWithoutDeptDesig = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '123456',
      };

      mockEmployeeRepo.findOne.mockResolvedValue(undefined); // Email is unique

      const mockEmployee = { id: 'emp-uuid', ...dtoWithoutDeptDesig, tenantId };
      mockEmployeeRepo.create.mockReturnValue(mockEmployee);
      mockEmployeeRepo.save.mockResolvedValue(mockEmployee);

      const result = await service.create(tenantId, dtoWithoutDeptDesig);
      expect(result).toEqual(mockEmployee);
      expect(mockEmployeeRepo.create).toHaveBeenCalledWith({ ...dtoWithoutDeptDesig, tenantId });
      expect(mockEmployeeRepo.save).toHaveBeenCalledWith(mockEmployee);
    });

    it('should create employee with only department (no designation)', async () => {
      const dtoWithOnlyDept = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '123456',
        departmentId: 'dept-uuid',
      };

      mockEmployeeRepo.findOne.mockResolvedValue(undefined); // Email is unique
      mockDepartmentRepo.findOneBy.mockResolvedValue({ id: 'dept-uuid', tenantId });

      const mockEmployee = { id: 'emp-uuid', ...dtoWithOnlyDept, tenantId };
      mockEmployeeRepo.create.mockReturnValue(mockEmployee);
      mockEmployeeRepo.save.mockResolvedValue(mockEmployee);

      const result = await service.create(tenantId, dtoWithOnlyDept);
      expect(result).toEqual(mockEmployee);
      expect(mockEmployeeRepo.create).toHaveBeenCalledWith({ ...dtoWithOnlyDept, tenantId });
      expect(mockEmployeeRepo.save).toHaveBeenCalledWith(mockEmployee);
    });

    it('should not validate designation if department is not provided', async () => {
      const dtoWithOnlyDesig = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '123456',
        designationId: 'desig-uuid',
      };

      mockEmployeeRepo.findOne.mockResolvedValue(undefined); // Email is unique

      const mockEmployee = { id: 'emp-uuid', ...dtoWithOnlyDesig, tenantId };
      mockEmployeeRepo.create.mockReturnValue(mockEmployee);
      mockEmployeeRepo.save.mockResolvedValue(mockEmployee);

      const result = await service.create(tenantId, dtoWithOnlyDesig);
      expect(result).toEqual(mockEmployee);
      expect(mockDepartmentRepo.findOneBy).not.toHaveBeenCalled();
      expect(mockDesignationRepo.findOneBy).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    const employeeId = 'emp-uuid';
    const existingEmployee = {
      id: employeeId,
      name: 'John Doe',
      email: 'john@example.com',
      phone: '123456',
      departmentId: 'dept-uuid',
      designationId: 'desig-uuid',
      tenantId,
    };

    it('should throw error if employee not found', async () => {
      mockEmployeeRepo.findOneBy.mockResolvedValue(undefined);

      await expect(service.update(tenantId, employeeId, updateDto)).rejects.toThrow(
        'Employee not found',
      );
    });

    it('should throw error if email already exists in tenant', async () => {
      mockEmployeeRepo.findOneBy.mockResolvedValue(existingEmployee);
      mockEmployeeRepo.findOne.mockResolvedValue({ id: 'other-emp', email: 'john.updated@example.com' });

      await expect(service.update(tenantId, employeeId, updateDto)).rejects.toThrow(
        'Employee with this email already exists in this tenant.',
      );
    });

    it('should update employee with email change successfully', async () => {
      const emailUpdateDto = { 
        name: 'John Doe Updated',
        email: 'john.newemail@example.com'
      };
      
      mockEmployeeRepo.findOneBy.mockResolvedValue(existingEmployee);
      mockEmployeeRepo.findOne.mockResolvedValue(undefined); // Email is unique (no other employee with this email)
      mockEmployeeRepo.save.mockResolvedValue({ ...existingEmployee, ...emailUpdateDto, email: 'john.newemail@example.com' });

      const result = await service.update(tenantId, employeeId, emailUpdateDto);
      expect(result).toEqual({ ...existingEmployee, ...emailUpdateDto, email: 'john.newemail@example.com' });
      expect(mockEmployeeRepo.findOne).toHaveBeenCalledWith({
        where: {
          email: 'john.newemail@example.com',
          tenantId,
          id: Not(employeeId)
        }
      });
    });

    it('should throw error if new department not found for tenant', async () => {
      mockEmployeeRepo.findOneBy.mockResolvedValue(existingEmployee);
      mockEmployeeRepo.findOne.mockResolvedValue(undefined); // Email is unique
      mockDepartmentRepo.findOneBy.mockResolvedValue(undefined);

      await expect(service.update(tenantId, employeeId, updateDto)).rejects.toThrow(
        'Invalid department for this tenant.',
      );
    });

    it('should throw error if new designation does not belong to new department', async () => {
      mockEmployeeRepo.findOneBy.mockResolvedValue(existingEmployee);
      mockEmployeeRepo.findOne.mockResolvedValue(undefined); // Email is unique
      mockDepartmentRepo.findOneBy.mockResolvedValue({ id: 'dept-uuid-2', tenantId });
      mockDesignationRepo.findOneBy.mockResolvedValue(undefined);

      await expect(service.update(tenantId, employeeId, updateDto)).rejects.toThrow(
        'Invalid designation for the selected department.',
      );
    });

    it('should update employee successfully if validations pass', async () => {
      mockEmployeeRepo.findOneBy.mockResolvedValue(existingEmployee);
      mockEmployeeRepo.findOne.mockResolvedValue(undefined); // Email is unique
      mockDepartmentRepo.findOneBy.mockResolvedValue({ id: 'dept-uuid-2', tenantId });
      mockDesignationRepo.findOneBy.mockResolvedValue({ id: 'desig-uuid-2', departmentId: 'dept-uuid-2' });

      const updatedEmployee = { ...existingEmployee, ...updateDto };
      mockEmployeeRepo.save.mockResolvedValue(updatedEmployee);

      const result = await service.update(tenantId, employeeId, updateDto);
      expect(result).toEqual(updatedEmployee);
      expect(mockEmployeeRepo.save).toHaveBeenCalledWith(updatedEmployee);
    });

    it('should update employee with only name (no department/designation changes)', async () => {
      const nameOnlyUpdate = { name: 'John Doe Updated' };
      mockEmployeeRepo.findOneBy.mockResolvedValue(existingEmployee);

      const updatedEmployee = { ...existingEmployee, ...nameOnlyUpdate };
      mockEmployeeRepo.save.mockResolvedValue(updatedEmployee);

      const result = await service.update(tenantId, employeeId, nameOnlyUpdate);
      expect(result).toEqual(updatedEmployee);
      expect(mockDepartmentRepo.findOneBy).not.toHaveBeenCalled();
      expect(mockDesignationRepo.findOneBy).not.toHaveBeenCalled();
    });

    it('should update employee with only new department (no designation)', async () => {
      const deptOnlyUpdate = { departmentId: 'dept-uuid-2' };
      mockEmployeeRepo.findOneBy.mockResolvedValue(existingEmployee);
      mockDepartmentRepo.findOneBy.mockResolvedValue({ id: 'dept-uuid-2', tenantId });

      const updatedEmployee = { ...existingEmployee, ...deptOnlyUpdate };
      mockEmployeeRepo.save.mockResolvedValue(updatedEmployee);

      const result = await service.update(tenantId, employeeId, deptOnlyUpdate);
      expect(result).toEqual(updatedEmployee);
      expect(mockDepartmentRepo.findOneBy).toHaveBeenCalledWith({ id: 'dept-uuid-2', tenantId });
      expect(mockDesignationRepo.findOneBy).not.toHaveBeenCalled();
    });

    it('should update employee with only new designation (no department change)', async () => {
      // Reset all mocks to ensure clean state
      jest.clearAllMocks();
      
      const designationOnlyDto = { designationId: 'test-desig-only' };
      const testEmployee = {
        id: 'test-emp-id',
        name: 'Test Employee',
        email: 'test@example.com',
        phone: '123456',
        departmentId: 'test-dept-id',
        designationId: 'old-desig-id',
        tenantId: 'test-tenant-id',
      };
      
      mockEmployeeRepo.findOneBy.mockResolvedValue(testEmployee);
      mockDesignationRepo.findOneBy.mockResolvedValue({ id: 'test-desig-only', departmentId: 'test-dept-id' });

      const updatedEmployee = { ...testEmployee, ...designationOnlyDto };
      mockEmployeeRepo.save.mockResolvedValue(updatedEmployee);

      const result = await service.update('test-tenant-id', 'test-emp-id', designationOnlyDto);
      expect(result).toEqual(updatedEmployee);
      expect(mockDepartmentRepo.findOneBy).not.toHaveBeenCalled();
      expect(mockDesignationRepo.findOneBy).toHaveBeenCalledWith({ id: 'test-desig-only', departmentId: 'test-dept-id' });
    });

    it('should not validate designation if department is not provided in update', async () => {
      const desigOnlyUpdate = { designationId: 'desig-uuid-2' };
      const employeeWithoutDept = { ...existingEmployee, departmentId: null };
      
      mockEmployeeRepo.findOneBy.mockResolvedValue(employeeWithoutDept);

      const updatedEmployee = { ...employeeWithoutDept, ...desigOnlyUpdate };
      mockEmployeeRepo.save.mockResolvedValue(updatedEmployee);

      const result = await service.update(tenantId, employeeId, desigOnlyUpdate);
      expect(result).toEqual(updatedEmployee);
      expect(mockDepartmentRepo.findOneBy).not.toHaveBeenCalled();
      expect(mockDesignationRepo.findOneBy).not.toHaveBeenCalled();
    });

    it('should not validate email if email is not being changed', async () => {
      const nameOnlyUpdate = { name: 'John Doe Updated' };
      mockEmployeeRepo.findOneBy.mockResolvedValue(existingEmployee);

      const updatedEmployee = { ...existingEmployee, ...nameOnlyUpdate };
      mockEmployeeRepo.save.mockResolvedValue(updatedEmployee);

      const result = await service.update(tenantId, employeeId, nameOnlyUpdate);
      expect(result).toEqual(updatedEmployee);
      expect(mockEmployeeRepo.findOne).not.toHaveBeenCalled(); // Email validation should not be called
    });
  });

  describe('findAll with filters', () => {
    const mockEmployees = [
      { id: 'emp1', name: 'John Doe', tenantId, departmentId: 'dept1', designationId: 'desig1' },
      { id: 'emp2', name: 'Jane Smith', tenantId, departmentId: 'dept2', designationId: 'desig2' },
    ];

    beforeEach(() => {
      mockEmployeeRepo.find.mockResolvedValue(mockEmployees);
    });

    it('should return all employees when no filters are provided', async () => {
      const query: EmployeeQueryDto = {};
      
      const result = await service.findAll(tenantId, query);
      
      expect(result).toEqual(mockEmployees);
      expect(mockEmployeeRepo.find).toHaveBeenCalledWith({
        where: { tenantId },
        relations: ['department', 'designation'],
        order: { createdAt: 'DESC' },
      });
    });

    it('should filter employees by department_id only', async () => {
      const query: EmployeeQueryDto = { department_id: 'dept1' };
      mockDepartmentRepo.findOneBy.mockResolvedValue({ id: 'dept1', tenantId });
      
      const result = await service.findAll(tenantId, query);
      
      expect(result).toEqual(mockEmployees);
      expect(mockDepartmentRepo.findOneBy).toHaveBeenCalledWith({ id: 'dept1', tenantId });
      expect(mockEmployeeRepo.find).toHaveBeenCalledWith({
        where: { tenantId, departmentId: 'dept1' },
        relations: ['department', 'designation'],
        order: { createdAt: 'DESC' },
      });
    });

    it('should filter employees by designation_id only', async () => {
      const query: EmployeeQueryDto = { designation_id: 'desig1' };
      const mockDesignation = {
        id: 'desig1',
        department: { tenantId }
      };
      mockDesignationRepo.findOne.mockResolvedValue(mockDesignation);
      
      const result = await service.findAll(tenantId, query);
      
      expect(result).toEqual(mockEmployees);
      expect(mockDesignationRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'desig1' },
        relations: ['department']
      });
      expect(mockEmployeeRepo.find).toHaveBeenCalledWith({
        where: { tenantId, designationId: 'desig1' },
        relations: ['department', 'designation'],
        order: { createdAt: 'DESC' },
      });
    });

    it('should filter employees by both department_id and designation_id', async () => {
      const query: EmployeeQueryDto = { 
        department_id: 'dept1', 
        designation_id: 'desig1' 
      };
      mockDepartmentRepo.findOneBy.mockResolvedValue({ id: 'dept1', tenantId });
      const mockDesignation = {
        id: 'desig1',
        department: { tenantId }
      };
      mockDesignationRepo.findOne.mockResolvedValue(mockDesignation);
      
      const result = await service.findAll(tenantId, query);
      
      expect(result).toEqual(mockEmployees);
      expect(mockDepartmentRepo.findOneBy).toHaveBeenCalledWith({ id: 'dept1', tenantId });
      expect(mockDesignationRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'desig1' },
        relations: ['department']
      });
      expect(mockEmployeeRepo.find).toHaveBeenCalledWith({
        where: { tenantId, departmentId: 'dept1', designationId: 'desig1' },
        relations: ['department', 'designation'],
        order: { createdAt: 'DESC' },
      });
    });

    it('should throw error for invalid department_id', async () => {
      const query: EmployeeQueryDto = { department_id: 'invalid-dept' };
      mockDepartmentRepo.findOneBy.mockResolvedValue(undefined);
      
      await expect(service.findAll(tenantId, query)).rejects.toThrow(
        'Invalid department for this tenant.'
      );
    });

    it('should throw error for invalid designation_id', async () => {
      const query: EmployeeQueryDto = { designation_id: 'invalid-desig' };
      mockDesignationRepo.findOne.mockResolvedValue(undefined);
      
      await expect(service.findAll(tenantId, query)).rejects.toThrow(
        'Invalid designation ID'
      );
    });

    it('should throw error when designation does not belong to tenant', async () => {
      const query: EmployeeQueryDto = { designation_id: 'desig1' };
      const mockDesignation = {
        id: 'desig1',
        department: { tenantId: 'different-tenant' }
      };
      mockDesignationRepo.findOne.mockResolvedValue(mockDesignation);
      
      await expect(service.findAll(tenantId, query)).rejects.toThrow(
        'Designation does not belong to this tenant'
      );
    });
  });
});
