import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DepartmentService } from './department.service';
import { Department } from '../../entities/department.entity';
import { Tenant } from '../../entities/tenant.entity';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('DepartmentService', () => {
  let service: DepartmentService;
  let repo: Repository<Department>;
  let tenantRepo: Repository<Tenant>;

  const tenantId = 'tenant-uuid';
  const deptId = 'dept-uuid';

  const mockTenant = { id: tenantId, name: 'Mock Tenant' } as Tenant;

  const mockDepartment: Department = {
    id: deptId,
    tenant_id: tenantId,
    name: 'Operations',
    description: 'Engineering dept',
    created_at: new Date(),
    tenant: mockTenant,
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
            save: jest.fn(),
            find: jest.fn(),
            delete: jest.fn(),
            create: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Tenant),
          useValue: {
            find: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DepartmentService>(DepartmentService);
    repo = module.get(getRepositoryToken(Department));
    tenantRepo = module.get(getRepositoryToken(Tenant));
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

    await expect(service.create(tenantId, { name: 'Engineering', description: '' })).rejects.toThrow(ConflictException);
  });

  it('should update department if name is unique', async () => {
    jest.spyOn(repo, 'findOne').mockResolvedValueOnce(mockDepartment).mockResolvedValueOnce(null);
    jest.spyOn(repo, 'save').mockResolvedValue({ ...mockDepartment, name: 'Ops' });

    const result = await service.update(tenantId, deptId, { name: 'Ops' });

    expect(result.name).toBe('Ops');
  });

  it('should allow update when name is unchanged (self-update)', async () => {
    jest.spyOn(repo, 'findOne').mockResolvedValue(mockDepartment);
    jest.spyOn(repo, 'save').mockResolvedValue(mockDepartment);

    const result = await service.update(tenantId, deptId, { name: 'Operations' });

    expect(result.name).toBe('Operations');
  });

  it('should throw ConflictException when updating to name used by another department', async () => {
    const anotherDepartment: Department = {
      id: 'other-id',
      tenant_id: tenantId,
      name: 'Engineering',
      description: 'Duplicate name',
      created_at: new Date(),
      tenant: mockTenant,
      designations: [],
    };

    jest.spyOn(repo, 'findOne').mockResolvedValueOnce(mockDepartment).mockResolvedValueOnce(anotherDepartment);

    await expect(service.update(tenantId, deptId, { name: 'Engineering' })).rejects.toThrow(ConflictException);
  });

  it('should throw NotFoundException when updating non-existent department', async () => {
    jest.spyOn(repo, 'findOne').mockResolvedValue(null);

    await expect(service.update(tenantId, 'non-existent-id', { name: 'New Name' })).rejects.toThrow(NotFoundException);
  });

  it('should delete department successfully', async () => {
    jest.spyOn(repo, 'findOne').mockResolvedValue(mockDepartment);
    jest.spyOn(repo, 'delete').mockResolvedValue({ affected: 1, raw: [] });

    const result = await service.remove(tenantId, deptId);

    expect(result).toEqual({ deleted: true, id: deptId });
  });

  it('should throw NotFoundException on delete if department does not exist', async () => {
    jest.spyOn(repo, 'findOne').mockResolvedValue(null);

    await expect(service.remove(tenantId, 'bad-id')).rejects.toThrow(NotFoundException);
  });

  it('getAllDepartmentsAcrossTenants should load tenants once and departments once', async () => {
    const t1 = { id: 't1', name: 'A' } as Tenant;
    const t2 = { id: 't2', name: 'B' } as Tenant;
    const tenantFindSpy = jest.spyOn(tenantRepo, 'find').mockResolvedValue([t1, t2]);

    const d1: Department = {
      ...mockDepartment,
      id: 'd1',
      tenant_id: 't1',
      name: 'Dept1',
      tenant: t1,
    };
    const d2: Department = {
      ...mockDepartment,
      id: 'd2',
      tenant_id: 't2',
      name: 'Dept2',
      tenant: t2,
    };
    const findSpy = jest.spyOn(repo, 'find').mockResolvedValue([d1, d2]);

    const out = await service.getAllDepartmentsAcrossTenants();

    expect(tenantFindSpy).toHaveBeenCalledTimes(1);
    expect(findSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        order: { name: 'ASC' },
      }),
    );
    expect(out.tenants).toHaveLength(2);
    expect(out.tenants[0].departments[0].name).toBe('Dept1');
    expect(out.tenants[1].departments[0].name).toBe('Dept2');
  });
});
