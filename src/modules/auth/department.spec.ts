import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DepartmentService } from '../department/department.service';
import { Department } from '../../entities/department.entity';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('DepartmentService', () => {
  let service: DepartmentService;
  let repo: Repository<Department>;

  const mockDepartment: Department = {
  id: 'dept-uuid',
  tenantId: 'tenant-uuid',
  name: 'Engineering',
  description: 'Engineering dept',
  createdAt: new Date(),
  updatedAt: new Date(),
  tenant: {
    id: 'tenant-uuid',
    name: 'Mock Tenant',
    
  } as any, 
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
      ],
    }).compile();

    service = module.get<DepartmentService>(DepartmentService);
    repo = module.get(getRepositoryToken(Department));
  });

  it('should create department if unique', async () => {
    jest.spyOn(repo, 'findOne').mockResolvedValue(null);
    jest.spyOn(repo, 'create').mockReturnValue(mockDepartment);
    jest.spyOn(repo, 'save').mockResolvedValue(mockDepartment);

    const result = await service.create('tenant-uuid', {
      name: 'Engineering',
      description: 'desc',
    });

    expect(result).toEqual(mockDepartment);
  });

  it('should throw conflict if duplicate name in same tenant', async () => {
    jest.spyOn(repo, 'findOne').mockResolvedValue(mockDepartment);

    await expect(
      service.create('tenant-uuid', { name: 'Engineering', description: '' }),
    ).rejects.toThrow(ConflictException);
  });

  it('should update department if name is unique', async () => {
    jest.spyOn(repo, 'findOneBy').mockResolvedValue(mockDepartment);
    jest.spyOn(repo, 'findOne').mockResolvedValue(null);
    jest
      .spyOn(repo, 'save')
      .mockResolvedValue({ ...mockDepartment, name: 'Ops' });

    const result = await service.update('tenant-uuid', 'dept-uuid', { name: 'Ops' });
    expect(result.name).toEqual('Ops');
  });

  it('should throw conflict if updating to existing name', async () => {
    jest.spyOn(repo, 'findOneBy').mockResolvedValue(mockDepartment);
    jest.spyOn(repo, 'findOne').mockResolvedValue({ ...mockDepartment });

    await expect(
      service.update('tenant-uuid', 'dept-uuid', { name: 'Engineering' }),
    ).rejects.toThrow(ConflictException);
  });

  it('should delete department', async () => {
    jest.spyOn(repo, 'findOne').mockResolvedValue(mockDepartment);
    jest.spyOn(repo, 'delete').mockResolvedValue({ affected: 1 } as any);

    const result = await service.remove('tenant-uuid', 'dept-uuid');
    expect(result).toEqual({ deleted: true, id: 'dept-uuid' });
  });

  it('should throw 404 on delete non-existent department', async () => {
    jest.spyOn(repo, 'findOne').mockResolvedValue(null);

    await expect(service.remove('tenant-uuid', 'bad-id')).rejects.toThrow(
      NotFoundException,
    );
  });
});
