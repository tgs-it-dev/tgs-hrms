import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { HolidayService } from './holiday.service';
import { Holiday } from '../../entities/holiday.entity';
import { CreateHolidayDto } from './dto/create-holiday.dto';

describe('HolidayService', () => {
  let service: HolidayService;
  let repository: Repository<Holiday>;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    createQueryBuilder: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HolidayService,
        {
          provide: getRepositoryToken(Holiday),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<HolidayService>(HolidayService);
    repository = module.get<Repository<Holiday>>(getRepositoryToken(Holiday));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createHoliday', () => {
    const tenantId = 'tenant-123';
    const createHolidayDto: CreateHolidayDto = {
      name: 'New Year Day',
      date: '2025-01-01',
      description: 'Public holiday celebrating the new year',
      is_active: true,
    };

    it('should create a holiday successfully', async () => {
      const expectedHoliday = {
        id: 'holiday-123',
        ...createHolidayDto,
        tenant_id: tenantId,
        date: new Date(createHolidayDto.date),
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(expectedHoliday);
      mockRepository.save.mockResolvedValue(expectedHoliday);

      const result = await service.createHoliday(tenantId, createHolidayDto);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: {
          tenant_id: tenantId,
          date: new Date(createHolidayDto.date),
        },
      });
      expect(mockRepository.create).toHaveBeenCalledWith({
        ...createHolidayDto,
        tenant_id: tenantId,
        date: new Date(createHolidayDto.date),
      });
      expect(mockRepository.save).toHaveBeenCalledWith(expectedHoliday);
      expect(result).toEqual(expectedHoliday);
    });

    it('should throw BadRequestException if holiday already exists for the same date', async () => {
      const existingHoliday = {
        id: 'existing-holiday-123',
        name: 'Existing Holiday',
        date: new Date(createHolidayDto.date),
        tenant_id: tenantId,
      };

      mockRepository.findOne.mockResolvedValue(existingHoliday);

      await expect(service.createHoliday(tenantId, createHolidayDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: {
          tenant_id: tenantId,
          date: new Date(createHolidayDto.date),
        },
      });
      expect(mockRepository.create).not.toHaveBeenCalled();
      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('getHolidays', () => {
    const tenantId = 'tenant-123';
    const mockHolidays = [
      {
        id: 'holiday-1',
        name: 'New Year Day',
        date: new Date('2025-01-01'),
        tenant_id: tenantId,
        is_active: true,
      },
      {
        id: 'holiday-2',
        name: 'Independence Day',
        date: new Date('2025-08-15'),
        tenant_id: tenantId,
        is_active: true,
      },
    ];

    it('should return paginated holidays for specific tenant', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockHolidays, 2]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getHolidays(tenantId, 1, 10);

      expect(mockRepository.createQueryBuilder).toHaveBeenCalledWith('holiday');
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('holiday.is_active = :isActive', { isActive: true });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('holiday.tenant_id = :tenantId', { tenantId });
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('holiday.date', 'ASC');
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
      expect(result).toEqual({
        items: mockHolidays,
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it('should return all holidays when tenantId is null (system-admin)', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockHolidays, 2]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getHolidays(null, 1, 10);

      expect(mockRepository.createQueryBuilder).toHaveBeenCalledWith('holiday');
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('holiday.is_active = :isActive', { isActive: true });
      // Should not filter by tenant_id when tenantId is null
      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalledWith('holiday.tenant_id = :tenantId', expect.anything());
      expect(result).toEqual({
        items: mockHolidays,
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it('should filter holidays by year when provided', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockHolidays, 2]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.getHolidays(tenantId, 1, 10, 2025);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('EXTRACT(YEAR FROM holiday.date) = :year', { year: 2025 });
    });
  });

  describe('getHolidayById', () => {
    const tenantId = 'tenant-123';
    const holidayId = 'holiday-123';
    const mockHoliday = {
      id: holidayId,
      name: 'New Year Day',
      date: new Date('2025-01-01'),
      tenant_id: tenantId,
      is_active: true,
    };

    it('should return holiday when found', async () => {
      mockRepository.findOne.mockResolvedValue(mockHoliday);

      const result = await service.getHolidayById(holidayId, tenantId);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: holidayId, tenant_id: tenantId },
      });
      expect(result).toEqual(mockHoliday);
    });

    it('should throw NotFoundException when holiday not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.getHolidayById(holidayId, tenantId)).rejects.toThrow(NotFoundException);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: holidayId, tenant_id: tenantId },
      });
    });
  });

  describe('updateHoliday', () => {
    const tenantId = 'tenant-123';
    const holidayId = 'holiday-123';
    const mockHoliday = {
      id: holidayId,
      name: 'New Year Day',
      date: '2025-01-01', // String date as it comes from database
      tenant_id: tenantId,
      is_active: true,
    };

    const updateDto = {
      name: 'Updated Holiday Name',
      description: 'Updated description',
    };

    it('should update holiday successfully with string date from database', async () => {
      mockRepository.findOne.mockResolvedValue(mockHoliday);
      mockRepository.save.mockResolvedValue({ ...mockHoliday, ...updateDto });

      const result = await service.updateHoliday(holidayId, tenantId, updateDto);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: holidayId, tenant_id: tenantId },
      });
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result).toEqual({ ...mockHoliday, ...updateDto });
    });

    it('should handle date update with string date from database', async () => {
      const mockHolidayWithDate = {
        ...mockHoliday,
        date: '2025-01-01', // String date
      };

      const updateDtoWithDate = {
        date: '2025-01-02',
      };

      mockRepository.findOne.mockResolvedValue(mockHolidayWithDate);
      mockRepository.save.mockResolvedValue({ ...mockHolidayWithDate, ...updateDtoWithDate });

      const result = await service.updateHoliday(holidayId, tenantId, updateDtoWithDate);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: holidayId, tenant_id: tenantId },
      });
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result).toEqual({ ...mockHolidayWithDate, ...updateDtoWithDate });
    });
  });

  describe('isHoliday', () => {
    const tenantId = 'tenant-123';
    const testDate = new Date('2025-01-01');

    it('should return true when holiday exists', async () => {
      const mockHoliday = {
        id: 'holiday-123',
        name: 'New Year Day',
        date: testDate,
        tenant_id: tenantId,
        is_active: true,
      };

      mockRepository.findOne.mockResolvedValue(mockHoliday);

      const result = await service.isHoliday(tenantId, testDate);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: {
          tenant_id: tenantId,
          date: testDate,
          is_active: true,
        },
      });
      expect(result).toBe(true);
    });

    it('should return false when holiday does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.isHoliday(tenantId, testDate);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: {
          tenant_id: tenantId,
          date: testDate,
          is_active: true,
        },
      });
      expect(result).toBe(false);
    });
  });
});
