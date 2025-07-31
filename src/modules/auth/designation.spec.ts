import { Test, TestingModule } from '@nestjs/testing';
import { DesignationService } from '../designation/designation.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Designation } from '../../entities/designation.entity';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('DesignationService', () => {
  let service: DesignationService;
  let repo: Repository<Designation>;

  const departmentId = 'dept-uuid';
  const mockDesignation: Designation = {
    id: 'desig-uuid',
    departmentId,
    title: 'Manager',
    tenantId: 'tenant-uuid',
    createdAt: new Date(),
    updatedAt: new Date(),
    department: {} as any,
    tenant: {} as any,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DesignationService,
        {
          provide: getRepositoryToken(Designation),
          useValue: {
            findOne: jest.fn(),
            findOneBy: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DesignationService>(DesignationService);
    repo = module.get(getRepositoryToken(Designation));
  });

  it('should create designation if title is unique', async () => {
    jest.spyOn(repo, 'findOne').mockResolvedValue(null);
    jest.spyOn(repo, 'create').mockReturnValue(mockDesignation);
    jest.spyOn(repo, 'save').mockResolvedValue(mockDesignation);

    const result = await service.create('tenant-uuid', {
      title: 'Manager',
      departmentId,
    });

    expect(result).toEqual(mockDesignation);
  });

  it('should throw ConflictException if duplicate title exists in same department', async () => {
    jest.spyOn(repo, 'findOne').mockResolvedValue(mockDesignation);

    await expect(
      service.create('tenant-uuid', {
        title: 'Manager',
        departmentId,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should update designation if title is unique', async () => {
    jest.spyOn(repo, 'findOneBy').mockResolvedValue(mockDesignation);
    jest.spyOn(repo, 'findOne').mockResolvedValue(null);
    jest.spyOn(repo, 'save').mockResolvedValue({ ...mockDesignation, title: 'Lead' });

    const result = await service.update('desig-uuid', { title: 'Lead' });
    expect(result.title).toBe('Lead');
  });

  it('should throw ConflictException when updating to duplicate title', async () => {
    const anotherDesignation = { ...mockDesignation, id: 'another-id' };
    jest.spyOn(repo, 'findOneBy').mockResolvedValue(mockDesignation);
    jest.spyOn(repo, 'findOne').mockResolvedValue(anotherDesignation);

    await expect(
      service.update('desig-uuid', { title: 'Manager' }),
    ).rejects.toThrow(ConflictException);
  });

  it('should delete designation', async () => {
    jest.spyOn(repo, 'findOneBy').mockResolvedValue(mockDesignation);
    jest.spyOn(repo, 'delete').mockResolvedValue({ affected: 1 } as any);

    const result = await service.remove('desig-uuid');
    expect(result).toEqual({ deleted: true, id: 'desig-uuid' });
  });

  it('should throw 404 if deleting non-existent designation', async () => {
    jest.spyOn(repo, 'findOneBy').mockResolvedValue(null);

    await expect(service.remove('bad-id')).rejects.toThrow(NotFoundException);
  });
});
