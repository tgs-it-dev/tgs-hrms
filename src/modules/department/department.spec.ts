import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DepartmentService } from './department.service';
import { Department } from '../../entities/department.entity';
import { Tenant } from '../../entities/tenant.entity';
import { TenantDatabaseService } from '../../common/services/tenant-database.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('DepartmentService', () => {
  let service: DepartmentService;
  let repo: Repository<Department>;

  const tenantId = 'tenant-uuid';
  const deptId = 'dept-uuid';

  const mockDepartment: Department = {
    id: deptId,
    tenant_id: tenantId,
    name: 'Operations',
    description: 'Engineering dept',
    created_at: new Date(),
    tenant: {
      id: tenantId,
      name: 'Mock Tenant',
    } as any,
    designations: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepartmentService,
        {
          provide: getRepositoryToken(Department),
          useValue: {
            findOne: jest.fn(),
            findOneBy: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            delete: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Tenant),
          useValue: {
            findOne: jest
              .fn()
              .mockResolvedValue({ id: tenantId, schema_provisioned: false }),
          },
        },
        {
          provide: TenantDatabaseService,
          useValue: {
            withTenantSchema: jest
              .fn()
              .mockImplementation(
                (_id: string, fn: (em: any) => Promise<any>) => fn({}),
              ),
            withTenantSchemaReadOnly: jest
              .fn()
              .mockImplementation(
                (_id: string, fn: (em: any) => Promise<any>) => fn({}),
              ),
          },
        },
      ],
    }).compile();

    service = module.get<DepartmentService>(DepartmentService);
    repo = module.get(getRepositoryToken(Department));
  });

  it('should create department if unique', async () => {
    jest.spyOn(repo, 'findOne').mockResolvedValue(null);
    jest.spyOn(repo, 'create').mockReturnValue(mockDepartment);
    jest.spyOn(repo, 'save').mockResolvedValue(mockDepartment);

    const result = await service.create(tenantId, {
      name: 'Engineering',
      description: 'desc',
    });

    expect(result).toEqual(mockDepartment);
  });

  it('should throw ConflictException if department already exists in same tenant', async () => {
    jest.spyOn(repo, 'findOne').mockResolvedValue(mockDepartment);

    await expect(
      service.create(tenantId, { name: 'Engineering', description: '' }),
    ).rejects.toThrow(ConflictException);
  });

  it('should update department if name is unique', async () => {
    jest
      .spyOn(repo, 'findOne')
      .mockResolvedValueOnce(mockDepartment) // initial lookup by id
      .mockResolvedValueOnce(null); // duplicate name check
    jest
      .spyOn(repo, 'save')
      .mockResolvedValue({ ...mockDepartment, name: 'Ops' });

    const result = await service.update(tenantId, deptId, { name: 'Ops' });

    expect(result.name).toBe('Ops');
  });

  it('should allow update when name is unchanged (self-update)', async () => {
    jest.spyOn(repo, 'findOne').mockResolvedValue(mockDepartment);
    jest.spyOn(repo, 'save').mockResolvedValue(mockDepartment);

    const result = await service.update(tenantId, deptId, {
      name: 'Operations',
    });

    expect(result.name).toBe('Operations');
  });

  it('should throw ConflictException when updating to name used by another department', async () => {
    const anotherDepartment: Department = {
      id: 'other-id',
      tenant_id: tenantId,
      name: 'Engineering',
      description: 'Duplicate name',
      created_at: new Date(),
      tenant: {
        id: tenantId,
        name: 'Mock Tenant',
      } as any,
      designations: [],
    };

    jest
      .spyOn(repo, 'findOne')
      .mockResolvedValueOnce(mockDepartment) // initial lookup by id
      .mockResolvedValueOnce(anotherDepartment); // duplicate name check

    await expect(
      service.update(tenantId, deptId, { name: 'Engineering' }),
    ).rejects.toThrow(ConflictException);
  });

  it('should throw NotFoundException when updating non-existent department', async () => {
    jest.spyOn(repo, 'findOne').mockResolvedValue(null);

    await expect(
      service.update(tenantId, 'non-existent-id', { name: 'New Name' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should delete department successfully', async () => {
    jest.spyOn(repo, 'findOne').mockResolvedValue(mockDepartment);
    jest.spyOn(repo, 'delete').mockResolvedValue({ affected: 1 } as any);

    const result = await service.remove(tenantId, deptId);

    expect(result).toEqual({ deleted: true, id: deptId });
  });

  it('should throw NotFoundException on delete if department does not exist', async () => {
    jest.spyOn(repo, 'findOne').mockResolvedValue(null);

    await expect(service.remove(tenantId, 'bad-id')).rejects.toThrow(
      NotFoundException,
    );
  });
});
