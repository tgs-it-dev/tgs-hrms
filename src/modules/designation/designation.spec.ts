import { Test, TestingModule } from '@nestjs/testing';
import { DesignationService } from './designation.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Designation } from '../../entities/designation.entity';
import { Department } from '../../entities/department.entity';
import { Tenant } from '../../entities/tenant.entity';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('DesignationService', () => {
  let service: DesignationService;
  let designationRepo: Repository<Designation>;
  let departmentRepo: Repository<Department>;
  let tenantRepo: Repository<Tenant>;

  const tenantId = '550e8400-e29b-41d4-a716-446655440000';
  const departmentId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
  const designationId = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';

  const mockTenant = { id: tenantId, name: 'T' } as Tenant;

  const mockDepartment: Department = {
    id: departmentId,
    name: 'Engineering',
    description: 'Engineering department',
    tenant_id: tenantId,
    created_at: new Date(),
    tenant: mockTenant,
    designations: [],
  };

  const mockDesignation: Designation = {
    id: designationId,
    tenant_id: tenantId,
    department_id: departmentId,
    title: 'Manager',
    created_at: new Date(),
    department: mockDepartment,
    tenant: mockTenant,
    employees: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DesignationService,
        {
          provide: getRepositoryToken(Designation),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            delete: jest.fn(),
            findAndCount: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Department),
          useValue: {
            findOne: jest.fn(),
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

    service = module.get<DesignationService>(DesignationService);
    designationRepo = module.get(getRepositoryToken(Designation));
    departmentRepo = module.get(getRepositoryToken(Department));
    tenantRepo = module.get(getRepositoryToken(Tenant));
  });

  it('should create designation if title is unique', async () => {
    jest.spyOn(departmentRepo, 'findOne').mockResolvedValue(mockDepartment);
    jest.spyOn(designationRepo, 'findOne').mockResolvedValue(null);
    jest.spyOn(designationRepo, 'create').mockReturnValue(mockDesignation);
    jest.spyOn(designationRepo, 'save').mockResolvedValue(mockDesignation);

    const result = await service.create(tenantId, {
      title: 'Manager',
      department_id: departmentId,
    });

    expect(result).toEqual(mockDesignation);
  });

  it('should throw ConflictException if duplicate title exists in same department', async () => {
    jest.spyOn(departmentRepo, 'findOne').mockResolvedValue(mockDepartment);
    jest.spyOn(designationRepo, 'findOne').mockResolvedValue(mockDesignation);

    await expect(
      service.create(tenantId, {
        title: 'Manager',
        department_id: departmentId,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should update designation if title is unique', async () => {
    jest
      .spyOn(designationRepo, 'findOne')
      .mockResolvedValueOnce({ ...mockDesignation })
      .mockResolvedValueOnce(null);
    jest.spyOn(designationRepo, 'save').mockResolvedValue({ ...mockDesignation, title: 'Lead' });

    const result = await service.update(designationId, { title: 'Lead' });
    expect(result.title).toBe('Lead');
  });

  it('should throw ConflictException when updating to duplicate title', async () => {
    const current = { ...mockDesignation, title: 'Senior' };
    const otherWithSameTitle = {
      ...mockDesignation,
      id: '6ba7b812-9dad-11d1-80b4-00c04fd430c8',
      title: 'Manager',
    };
    jest.spyOn(designationRepo, 'findOne').mockResolvedValueOnce(current).mockResolvedValueOnce(otherWithSameTitle);

    await expect(service.update(designationId, { title: 'Manager' })).rejects.toThrow(ConflictException);
  });

  it('should delete designation', async () => {
    jest.spyOn(designationRepo, 'findOne').mockResolvedValue(mockDesignation);
    jest.spyOn(designationRepo, 'delete').mockResolvedValue({ affected: 1, raw: [] });

    const result = await service.remove(designationId);
    expect(result).toEqual({ deleted: true, id: designationId });
  });

  it('should throw 404 if deleting non-existent designation', async () => {
    jest.spyOn(designationRepo, 'findOne').mockResolvedValue(null);

    await expect(service.remove('6ba7b813-9dad-11d1-80b4-00c04fd430c8')).rejects.toThrow(NotFoundException);
  });

  it('getAllDesignationsAcrossTenants should batch-load designations in one query', async () => {
    const t1 = { id: 't1', name: 'A', status: 'active' as const } as Tenant;
    const tenantFindSpy = jest.spyOn(tenantRepo, 'find').mockResolvedValue([t1]);

    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          ...mockDesignation,
          id: 'd1',
          tenant_id: 't1',
          title: 'Dev',
          department: { ...mockDepartment, id: 'dep1', name: 'Eng' },
        },
      ]),
    };
    const createQbSpy = jest.spyOn(designationRepo, 'createQueryBuilder').mockReturnValue(qb as never);

    const out = await service.getAllDesignationsAcrossTenants();

    expect(tenantFindSpy).toHaveBeenCalledTimes(1);
    expect(createQbSpy).toHaveBeenCalledWith('designation');
    expect(out.tenants).toHaveLength(1);
    expect(out.tenants[0].departments[0].designations[0].title).toBe('Dev');
  });
});
