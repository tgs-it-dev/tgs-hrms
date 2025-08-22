import { 
  Injectable, 
  NotFoundException, 
  BadRequestException, 
  ConflictException,
  ForbiddenException 
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Holiday } from '../../entities/holiday.entity';
import { Tenant } from '../../entities/tenant.entity';
import { CreateHolidayDto } from './dto/create-holiday.dto';

@Injectable()
export class HolidayService {
  constructor(
    @InjectRepository(Holiday)
    private holidayRepo: Repository<Holiday>,
    @InjectRepository(Tenant)
    private tenantRepo: Repository<Tenant>,
  ) {}

  async createHoliday(tenantId: string, dto: CreateHolidayDto): Promise<Holiday> {
    // Validate tenant exists
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Convert date string to Date object
    const holidayDate = new Date(dto.date);
    
    // Validate date is not in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (holidayDate < today) {
      throw new BadRequestException('Cannot create holidays for past dates');
    }

    // Check for duplicate holiday on the same date for the tenant
    const existingHoliday = await this.holidayRepo.findOne({
      where: {
        tenant_id: tenantId,
        date: holidayDate,
      },
    });

    if (existingHoliday) {
      throw new ConflictException(`A holiday already exists for ${dto.date} in this tenant`);
    }

    // Create the holiday
    const holiday = this.holidayRepo.create({
      ...dto,
      tenant_id: tenantId,
      date: holidayDate,
      is_active: dto.is_active !== undefined ? dto.is_active : true,
    });

    const savedHoliday = await this.holidayRepo.save(holiday);
    
    // ✅ Null-safe return
    const holidayWithTenant = await this.holidayRepo.findOne({
      where: { id: savedHoliday.id },
      relations: ['tenant'],
    });

    if (!holidayWithTenant) {
      throw new NotFoundException('Holiday not found after creation');
    }

    return holidayWithTenant;
  }

  async getHolidays(tenantId: string, year?: number, month?: number): Promise<Holiday[]> {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    let query = this.holidayRepo.createQueryBuilder('holiday')
      .leftJoinAndSelect('holiday.tenant', 'tenant')
      .where('holiday.tenant_id = :tenantId', { tenantId })
      .orderBy('holiday.date', 'ASC');

    if (year) {
      query = query.andWhere('EXTRACT(YEAR FROM holiday.date) = :year', { year });
    }

    if (month) {
      if (month < 1 || month > 12) {
        throw new BadRequestException('Month must be between 1 and 12');
      }
      query = query.andWhere('EXTRACT(MONTH FROM holiday.date) = :month', { month });
    }

    return await query.getMany();
  }

  async getHolidaysByDateRange(tenantId: string, startDate: string, endDate: string): Promise<Holiday[]> {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      throw new BadRequestException('Start date cannot be after end date');
    }

    return await this.holidayRepo.find({
      where: {
        tenant_id: tenantId,
        date: Between(start, end),
        is_active: true,
      },
      relations: ['tenant'],
      order: { date: 'ASC' },
    });
  }

  async isHoliday(tenantId: string, date: string): Promise<{ isHoliday: boolean; holiday?: Holiday }> {
    const holidayDate = new Date(date);
    
    const holiday = await this.holidayRepo.findOne({
      where: {
        tenant_id: tenantId,
        date: holidayDate,
        is_active: true,
      },
    });

    return {
      isHoliday: !!holiday,
      holiday: holiday || undefined,
    };
  }

  async getUpcomingHolidays(tenantId: string, limit: number = 5): Promise<Holiday[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return await this.holidayRepo.find({
      where: {
        tenant_id: tenantId,
        date: Between(today, new Date(today.getFullYear() + 1, 11, 31)),
        is_active: true,
      },
      relations: ['tenant'],
      order: { date: 'ASC' },
      take: limit,
    });
  }

  async getHolidayStats(tenantId: string, year: number): Promise<{
    totalHolidays: number;
    activeHolidays: number;
    inactiveHolidays: number;
  }> {
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);

    const [totalHolidays, activeHolidays, inactiveHolidays] = await Promise.all([
      this.holidayRepo.count({
        where: {
          tenant_id: tenantId,
          date: Between(startOfYear, endOfYear),
        },
      }),
      this.holidayRepo.count({
        where: {
          tenant_id: tenantId,
          date: Between(startOfYear, endOfYear),
          is_active: true,
        },
      }),
      this.holidayRepo.count({
        where: {
          tenant_id: tenantId,
          date: Between(startOfYear, endOfYear),
          is_active: false,
        },
      }),
    ]);

    return {
      totalHolidays,
      activeHolidays,
      inactiveHolidays,
    };
  }
}
