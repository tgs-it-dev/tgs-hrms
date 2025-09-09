import { Test, TestingModule } from '@nestjs/testing';
import { HolidayController } from './holiday.controller';
import { HolidayService } from './holiday.service';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { UpdateHolidayDto } from './dto/update-holiday.dto';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('HolidayController', () => {
  let controller: HolidayController;
  let service: HolidayService;

  const mockHolidayService = {
    createHoliday: jest.fn(),
    getHolidays: jest.fn(),
    getHolidayById: jest.fn(),
    updateHoliday: jest.fn(),
    deleteHoliday: jest.fn(),
    isHoliday: jest.fn(),
    getHolidaysByDateRange: jest.fn(),
  };

  const mockUser = {
    id: 'user-123',
    tenant_id: 'tenant-123',
    role: 'admin',
    permissions: ['manage_holidays'],
  };

  const mockSystemAdminUser = {
    id: 'system-admin-123',
    tenant_id: 'tenant-123',
    role: 'system-admin',
    permissions: ['manage_holidays'],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HolidayController],
      providers: [
        {
          provide: HolidayService,
          useValue: mockHolidayService,
        },
      ],
    }).compile();

    controller = module.get<HolidayController>(HolidayController);
    service = module.get<HolidayService>(HolidayService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createHoliday', () => {
    const createHolidayDto: CreateHolidayDto = {
      name: 'New Year Day',
      date: '2025-01-01',
      description: 'Public holiday celebrating the new year',
      is_active: true,
    };

    const mockRequest = {
      user: mockUser,
    };

    it('should create a holiday successfully', async () => {
      const expectedHoliday = {
        id: 'holiday-123',
        ...createHolidayDto,
        tenant_id: mockUser.tenant_id,
        date: new Date(createHolidayDto.date),
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockHolidayService.createHoliday.mockResolvedValue(expectedHoliday);

      const result = await controller.createHoliday(createHolidayDto, mockRequest);

      expect(mockHolidayService.createHoliday).toHaveBeenCalledWith(
        mockUser.tenant_id,
        createHolidayDto,
      );
      expect(result).toEqual(expectedHoliday);
    });

    it('should throw BadRequestException when holiday already exists', async () => {
      mockHolidayService.createHoliday.mockRejectedValue(
        new BadRequestException('A holiday already exists for this date'),
      );

      await expect(controller.createHoliday(createHolidayDto, mockRequest)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockHolidayService.createHoliday).toHaveBeenCalledWith(
        mockUser.tenant_id,
        createHolidayDto,
      );
    });
  });

  describe('getHolidays', () => {
    const mockRequest = {
      user: mockUser,
    };

    const mockHolidays = [
      {
        id: 'holiday-1',
        name: 'New Year Day',
        date: new Date('2025-01-01'),
        tenant_id: mockUser.tenant_id,
        is_active: true,
      },
      {
        id: 'holiday-2',
        name: 'Independence Day',
        date: new Date('2025-08-15'),
        tenant_id: mockUser.tenant_id,
        is_active: true,
      },
    ];

    it('should return paginated holidays with default parameters for regular user', async () => {
      const expectedResponse = {
        items: mockHolidays,
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
      };

      mockHolidayService.getHolidays.mockResolvedValue(expectedResponse);

      const result = await controller.getHolidays(mockRequest);

      expect(mockHolidayService.getHolidays).toHaveBeenCalledWith(
        mockUser.tenant_id,
        1,
        10,
        undefined,
      );
      expect(result).toEqual(expectedResponse);
    });

    it('should return all holidays for system-admin user', async () => {
      const systemAdminRequest = {
        user: mockSystemAdminUser,
      };

      const expectedResponse = {
        items: mockHolidays,
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
      };

      mockHolidayService.getHolidays.mockResolvedValue(expectedResponse);

      const result = await controller.getHolidays(systemAdminRequest);

      expect(mockHolidayService.getHolidays).toHaveBeenCalledWith(
        null, // System-admin gets null tenantId to access all holidays
        1,
        10,
        undefined,
      );
      expect(result).toEqual(expectedResponse);
    });

    it('should return paginated holidays with custom parameters', async () => {
      const expectedResponse = {
        items: mockHolidays,
        total: 2,
        page: 2,
        limit: 5,
        totalPages: 1,
      };

      mockHolidayService.getHolidays.mockResolvedValue(expectedResponse);

      const result = await controller.getHolidays(mockRequest, '2', '5', '2025');

      expect(mockHolidayService.getHolidays).toHaveBeenCalledWith(
        mockUser.tenant_id,
        2,
        5,
        2025,
      );
      expect(result).toEqual(expectedResponse);
    });

    it('should handle invalid page and limit parameters', async () => {
      const expectedResponse = {
        items: mockHolidays,
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
      };

      mockHolidayService.getHolidays.mockResolvedValue(expectedResponse);

      const result = await controller.getHolidays(mockRequest, 'invalid', 'invalid');

      expect(mockHolidayService.getHolidays).toHaveBeenCalledWith(
        mockUser.tenant_id,
        1,
        10,
        undefined,
      );
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('getHolidayById', () => {
    const holidayId = 'holiday-123';
    const mockRequest = {
      user: mockUser,
    };

    const mockHoliday = {
      id: holidayId,
      name: 'New Year Day',
      date: new Date('2025-01-01'),
      tenant_id: mockUser.tenant_id,
      is_active: true,
    };

    it('should return holiday when found', async () => {
      mockHolidayService.getHolidayById.mockResolvedValue(mockHoliday);

      const result = await controller.getHolidayById(holidayId, mockRequest);

      expect(mockHolidayService.getHolidayById).toHaveBeenCalledWith(
        holidayId,
        mockUser.tenant_id,
      );
      expect(result).toEqual(mockHoliday);
    });

    it('should throw NotFoundException when holiday not found', async () => {
      mockHolidayService.getHolidayById.mockRejectedValue(
        new NotFoundException('Holiday not found'),
      );

      await expect(controller.getHolidayById(holidayId, mockRequest)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockHolidayService.getHolidayById).toHaveBeenCalledWith(
        holidayId,
        mockUser.tenant_id,
      );
    });
  });

  describe('updateHoliday', () => {
    const holidayId = 'holiday-123';
    const updateHolidayDto: UpdateHolidayDto = {
      name: 'Updated Holiday Name',
      description: 'Updated description',
    };
    const mockRequest = {
      user: mockUser,
    };

    const updatedHoliday = {
      id: holidayId,
      name: 'Updated Holiday Name',
      date: new Date('2025-01-01'),
      description: 'Updated description',
      tenant_id: mockUser.tenant_id,
      is_active: true,
    };

    it('should update holiday successfully', async () => {
      mockHolidayService.updateHoliday.mockResolvedValue(updatedHoliday);

      const result = await controller.updateHoliday(holidayId, updateHolidayDto, mockRequest);

      expect(mockHolidayService.updateHoliday).toHaveBeenCalledWith(
        holidayId,
        mockUser.tenant_id,
        updateHolidayDto,
      );
      expect(result).toEqual(updatedHoliday);
    });
  });

  describe('deleteHoliday', () => {
    const holidayId = 'holiday-123';
    const mockRequest = {
      user: mockUser,
    };

    it('should delete holiday successfully', async () => {
      mockHolidayService.deleteHoliday.mockResolvedValue(undefined);

      const result = await controller.deleteHoliday(holidayId, mockRequest);

      expect(mockHolidayService.deleteHoliday).toHaveBeenCalledWith(
        holidayId,
        mockUser.tenant_id,
      );
      expect(result).toEqual({ message: 'Holiday deleted successfully' });
    });
  });

  describe('checkHoliday', () => {
    const testDate = '2025-01-01';
    const mockRequest = {
      user: mockUser,
    };

    it('should return true when date is a holiday', async () => {
      const mockHoliday = {
        id: 'holiday-123',
        name: 'New Year Day',
        date: new Date(testDate),
        tenant_id: mockUser.tenant_id,
        is_active: true,
      };

      mockHolidayService.isHoliday.mockResolvedValue(true);
      mockHolidayService.getHolidaysByDateRange.mockResolvedValue([mockHoliday]);

      const result = await controller.checkHoliday(testDate, mockRequest);

      expect(mockHolidayService.isHoliday).toHaveBeenCalledWith(
        mockUser.tenant_id,
        new Date(testDate),
      );
      expect(mockHolidayService.getHolidaysByDateRange).toHaveBeenCalledWith(
        mockUser.tenant_id,
        new Date(testDate),
        new Date(testDate),
      );
      expect(result).toEqual({
        isHoliday: true,
        holiday: mockHoliday,
      });
    });

    it('should return false when date is not a holiday', async () => {
      mockHolidayService.isHoliday.mockResolvedValue(false);

      const result = await controller.checkHoliday(testDate, mockRequest);

      expect(mockHolidayService.isHoliday).toHaveBeenCalledWith(
        mockUser.tenant_id,
        new Date(testDate),
      );
      expect(result).toEqual({
        isHoliday: false,
        holiday: null,
      });
    });
  });
});
