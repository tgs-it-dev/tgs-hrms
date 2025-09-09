import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LeaveService } from './leave.service';
import { HolidayService } from '../holiday/holiday.service';
import { Leave } from '../../entities/leave.entity';
import { User } from '../../entities/user.entity';
import { Employee } from '../../entities/employee.entity';
import { CreateLeaveDto } from './dto/create-leave.dto';

describe('LeaveService', () => {
  let service: LeaveService;
  let leaveRepository: Repository<Leave>;
  let userRepository: Repository<User>;
  let employeeRepository: Repository<Employee>;
  let holidayService: HolidayService;

  const mockLeaveRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockEmployeeRepository = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockHolidayService = {
    isHoliday: jest.fn(),
    getHolidaysByDateRange: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaveService,
        {
          provide: getRepositoryToken(Leave),
          useValue: mockLeaveRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(Employee),
          useValue: mockEmployeeRepository,
        },
        {
          provide: HolidayService,
          useValue: mockHolidayService,
        },
      ],
    }).compile();

    service = module.get<LeaveService>(LeaveService);
    leaveRepository = module.get<Repository<Leave>>(getRepositoryToken(Leave));
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    employeeRepository = module.get<Repository<Employee>>(getRepositoryToken(Employee));
    holidayService = module.get<HolidayService>(HolidayService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createLeave', () => {
    const userId = 'user-123';
    const tenantId = 'tenant-123';
    const createLeaveDto: CreateLeaveDto = {
      from_date: '2025-01-01',
      to_date: '2025-01-01',
      reason: 'Personal leave',
      type: 'casual',
    };

    const mockUser = {
      id: userId,
      tenant_id: tenantId,
      email: 'test@example.com',
    };

    const mockLeave = {
      id: 'leave-123',
      ...createLeaveDto,
      user_id: userId,
      status: 'pending',
    };

    it('should create leave successfully when no holidays are present', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockHolidayService.isHoliday.mockResolvedValue(false);
      mockLeaveRepository.create.mockReturnValue(mockLeave);
      mockLeaveRepository.save.mockResolvedValue(mockLeave);

      const result = await service.createLeave(userId, createLeaveDto, tenantId);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { id: userId } });
      expect(mockHolidayService.isHoliday).toHaveBeenCalledWith(tenantId, new Date('2025-01-01'));
      expect(mockLeaveRepository.create).toHaveBeenCalledWith({ ...createLeaveDto, user_id: userId });
      expect(mockLeaveRepository.save).toHaveBeenCalledWith(mockLeave);
      expect(result).toEqual(mockLeave);
    });

    it('should throw BadRequestException when leave is applied on a holiday', async () => {
      const mockHoliday = {
        id: 'holiday-123',
        name: 'New Year Day',
        date: '2025-01-01',
        description: 'Public holiday',
        is_active: true,
        tenant_id: tenantId,
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockHolidayService.isHoliday.mockResolvedValue(true);
      mockHolidayService.getHolidaysByDateRange.mockResolvedValue([mockHoliday]);

      await expect(service.createLeave(userId, createLeaveDto, tenantId)).rejects.toThrow(
        BadRequestException,
      );

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { id: userId } });
      expect(mockHolidayService.isHoliday).toHaveBeenCalledWith(tenantId, new Date('2025-01-01'));
      expect(mockHolidayService.getHolidaysByDateRange).toHaveBeenCalledWith(
        tenantId,
        new Date('2025-01-01'),
        new Date('2025-01-01'),
      );
      expect(mockLeaveRepository.create).not.toHaveBeenCalled();
      expect(mockLeaveRepository.save).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when user is not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.createLeave(userId, createLeaveDto, tenantId)).rejects.toThrow(
        NotFoundException,
      );

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { id: userId } });
      expect(mockHolidayService.isHoliday).not.toHaveBeenCalled();
      expect(mockLeaveRepository.create).not.toHaveBeenCalled();
      expect(mockLeaveRepository.save).not.toHaveBeenCalled();
    });

    it('should handle multiple holidays in date range', async () => {
      const multiDayLeaveDto: CreateLeaveDto = {
        from_date: '2025-01-01',
        to_date: '2025-01-03',
        reason: 'Multi-day leave',
        type: 'casual',
      };

      const mockHoliday1 = {
        id: 'holiday-1',
        name: 'New Year Day',
        date: '2025-01-01',
        description: 'Public holiday',
        is_active: true,
        tenant_id: tenantId,
      };

      const mockHoliday2 = {
        id: 'holiday-2',
        name: 'Another Holiday',
        date: '2025-01-02',
        description: 'Another public holiday',
        is_active: true,
        tenant_id: tenantId,
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockHolidayService.isHoliday
        .mockResolvedValueOnce(true)  // 2025-01-01
        .mockResolvedValueOnce(true)  // 2025-01-02
        .mockResolvedValueOnce(false); // 2025-01-03

      mockHolidayService.getHolidaysByDateRange
        .mockResolvedValueOnce([mockHoliday1])  // 2025-01-01
        .mockResolvedValueOnce([mockHoliday2]); // 2025-01-02

      await expect(service.createLeave(userId, multiDayLeaveDto, tenantId)).rejects.toThrow(
        BadRequestException,
      );

      expect(mockHolidayService.isHoliday).toHaveBeenCalledTimes(3);
      expect(mockHolidayService.getHolidaysByDateRange).toHaveBeenCalledTimes(2);
    });
  });
});
