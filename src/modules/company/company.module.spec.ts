import { Test, TestingModule } from '@nestjs/testing';
import { CompanyController } from './company.controller';
import { CompanyService } from './company.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { NotFoundException } from '@nestjs/common';
import { Company } from '../../entities/company.entity';

describe('CompanyController', () => {
  let controller: CompanyController;
  let service: CompanyService;

  const mockCompany: Company = {
    id: 'uuid-company-id',
    name: 'ABC Ltd',
  } as Company;

  const mockRequest = {
    user: {
      id: 'user-id',
      email: 'admin@company.com',
      role: 'ADMIN',
      tenantId: 'tenant-id',
    },
  };

  const mockCompanyService = {
    create: jest.fn().mockResolvedValue(mockCompany),
    findAll: jest.fn().mockResolvedValue([mockCompany]),
    findOne: jest.fn().mockResolvedValue(mockCompany),
    update: jest.fn().mockResolvedValue({ ...mockCompany, name: 'Updated Name' }),
    remove: jest.fn().mockResolvedValue(mockCompany),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CompanyController],
      providers: [
        {
          provide: CompanyService,
          useValue: mockCompanyService,
        },
      ],
    }).compile();

    controller = module.get<CompanyController>(CompanyController);
    service = module.get<CompanyService>(CompanyService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a company', async () => {
      const dto: CreateCompanyDto = { name: 'ABC Ltd' };
      const result = await controller.create(dto, mockRequest);
      expect(result).toEqual(mockCompany);
      expect(service.create).toHaveBeenCalledWith(dto, mockRequest.user);
    });
  });

  describe('findAll', () => {
    it('should return all companies', async () => {
      const result = await controller.findAll();
      expect(result).toEqual([mockCompany]);
    });
  });

  describe('findOne', () => {
    it('should return a company by id', async () => {
      const result = await controller.findOne('uuid-company-id');
      expect(result).toEqual(mockCompany);
    });

    it('should throw if company not found', async () => {
      jest.spyOn(service, 'findOne').mockRejectedValueOnce(new NotFoundException('Company not found'));

      await expect(controller.findOne('not-found-id')).rejects.toThrow(
        new NotFoundException('Company not found'),
      );
    });
  });

  describe('update', () => {
    it('should update a company', async () => {
      const dto: UpdateCompanyDto = { name: 'Updated Name' };
      const result = await controller.update('uuid-company-id', dto, mockRequest);
      expect(result).toEqual({ ...mockCompany, name: 'Updated Name' });
    });

    it('should throw if company to update is not found', async () => {
      jest.spyOn(service, 'update').mockRejectedValueOnce(new NotFoundException('Company not found'));

      await expect(
        controller.update('not-found-id', { name: 'New' }, mockRequest),
      ).rejects.toThrow(new NotFoundException('Company not found'));
    });
  });

  describe('remove', () => {
    it('should remove a company', async () => {
      const result = await controller.remove('uuid-company-id', mockRequest);
      expect(result).toEqual(mockCompany);
    });

    it('should throw if company to delete is not found', async () => {
      jest.spyOn(service, 'remove').mockRejectedValueOnce(new NotFoundException('Company not found'));

      await expect(controller.remove('not-found-id', mockRequest)).rejects.toThrow(
        new NotFoundException('Company not found'),
      );
    });
  });
});
