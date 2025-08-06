import { Test, TestingModule } from '@nestjs/testing';
import { DesignationService } from './designation.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Designation } from '../../entities/designation.entity';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('DesignationService', () => {
  let service: DesignationService;
  let repo: Repository<Designation>;

  // Use proper UUID format
  const tenantId = '550e8400-e29b-41d4-a716-446655440000';
  const departmentId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
  const designationId = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
  
  const mockDesignation: Designation = {
    id: designationId,
    departmentId,
    tenantId,
    title: 'Manager',
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

    const result = await service.create(tenantId, {
      title: 'Manager',
      departmentId,
    });

    expect(result).toEqual(mockDesignation);
  });

  it('should throw ConflictException if duplicate title exists in same department', async () => {
    jest.spyOn(repo, 'findOne').mockResolvedValue(mockDesignation);

    await expect(
      service.create(tenantId, {
        title: 'Manager',
        departmentId,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should update designation if title is unique', async () => {
    jest.spyOn(repo, 'findOneBy').mockResolvedValue(mockDesignation);
    jest.spyOn(repo, 'findOne').mockResolvedValue(null);
    jest.spyOn(repo, 'save').mockResolvedValue({ ...mockDesignation, title: 'Lead' });

    const result = await service.update(designationId, { title: 'Lead' });
    expect(result.title).toBe('Lead');
  });

  it('should throw ConflictException when updating to duplicate title', async () => {
    const anotherDesignation = { ...mockDesignation, id: '6ba7b812-9dad-11d1-80b4-00c04fd430c8' };
    jest.spyOn(repo, 'findOneBy').mockResolvedValue(mockDesignation);
    jest.spyOn(repo, 'findOne').mockResolvedValue(anotherDesignation);

    await expect(
      service.update(designationId, { title: 'Manager' }),
    ).rejects.toThrow(ConflictException);
  });

  it('should delete designation', async () => {
    jest.spyOn(repo, 'findOneBy').mockResolvedValue(mockDesignation);
    jest.spyOn(repo, 'delete').mockResolvedValue({ affected: 1 } as any);

    const result = await service.remove(designationId);
    expect(result).toEqual({ deleted: true, id: designationId });
  });

  it('should throw 404 if deleting non-existent designation', async () => {
    jest.spyOn(repo, 'findOneBy').mockResolvedValue(null);

    await expect(service.remove('6ba7b813-9dad-11d1-80b4-00c04fd430c8')).rejects.toThrow(NotFoundException);
  });
});
