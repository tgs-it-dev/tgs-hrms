import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Holiday } from '../../entities/holiday.entity';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { UpdateHolidayDto } from './dto/update-holiday.dto';
import { PaginationResponse } from '../../common/interfaces/pagination.interface';

@Injectable()
export class HolidayService {
  constructor(
    @InjectRepository(Holiday)
    private holidayRepository: Repository<Holiday>,
  ) {}

  async createHoliday(tenantId: string, dto: CreateHolidayDto): Promise<Holiday> {
    // Check if holiday already exists for the same date and tenant
    const existingHoliday = await this.holidayRepository.findOne({
      where: {
        tenant_id: tenantId,
        date: new Date(dto.date),
      },
    });

    if (existingHoliday) {
      throw new BadRequestException('A holiday already exists for this date');
    }

    const holiday = this.holidayRepository.create({
      ...dto,
      tenant_id: tenantId,
      date: new Date(dto.date),
    });

    return await this.holidayRepository.save(holiday);
  }

  async getHolidays(
    tenantId: string | null,
    page: number = 1,
    limit: number = 10,
    year?: number,
  ): Promise<PaginationResponse<Holiday>> {
    const skip = (page - 1) * limit;
    
    let query = this.holidayRepository
      .createQueryBuilder('holiday')
      .andWhere('holiday.is_active = :isActive', { isActive: true });

    // If tenantId is provided, filter by tenant (for regular users)
    // If tenantId is null, get all holidays (for system-admin)
    if (tenantId) {
      query = query.andWhere('holiday.tenant_id = :tenantId', { tenantId });
    }

    // Filter by year if provided
    if (year) {
      query = query.andWhere('EXTRACT(YEAR FROM holiday.date) = :year', { year });
    }

    const [items, total] = await query
      .orderBy('holiday.date', 'ASC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const totalPages = Math.ceil(total / limit);

    return {
      items,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async getHolidayById(id: string, tenantId: string | null): Promise<Holiday> {
    let whereCondition: any = { id };
    
    // If tenantId is provided, filter by tenant (for regular users)
    // If tenantId is null, get holiday from any tenant (for system-admin)
    if (tenantId) {
      whereCondition.tenant_id = tenantId;
    }

    const holiday = await this.holidayRepository.findOne({
      where: whereCondition,
    });

    if (!holiday) {
      throw new NotFoundException('Holiday not found');
    }

    return holiday;
  }

  async updateHoliday(
    id: string,
    tenantId: string | null,
    dto: UpdateHolidayDto,
  ): Promise<Holiday> {
    const holiday = await this.getHolidayById(id, tenantId);

    // If updating date, check for conflicts
    const currentDateString = holiday.date instanceof Date 
      ? holiday.date.toISOString().split('T')[0]
      : new Date(holiday.date).toISOString().split('T')[0];
    
    if (dto.date && dto.date !== currentDateString) {
      let conflictWhereCondition: any = {
        date: new Date(dto.date),
      };
      
      // For system-admin, check conflicts across all tenants
      // For regular users, check conflicts only within their tenant
      if (tenantId) {
        conflictWhereCondition.tenant_id = tenantId;
      }

      const existingHoliday = await this.holidayRepository.findOne({
        where: conflictWhereCondition,
      });

      if (existingHoliday && existingHoliday.id !== id) {
        throw new BadRequestException('A holiday already exists for this date');
      }
    }

    Object.assign(holiday, {
      ...dto,
      ...(dto.date && { date: new Date(dto.date) }),
    });

    return await this.holidayRepository.save(holiday);
  }

  async deleteHoliday(id: string, tenantId: string | null): Promise<void> {
    const holiday = await this.getHolidayById(id, tenantId);
    await this.holidayRepository.remove(holiday);
  }

  async getHolidaysByDateRange(
    tenantId: string | null,
    startDate: Date,
    endDate: Date,
  ): Promise<Holiday[]> {
    let query = this.holidayRepository
      .createQueryBuilder('holiday')
      .where('holiday.is_active = :isActive', { isActive: true })
      .andWhere('holiday.date >= :startDate', { startDate })
      .andWhere('holiday.date <= :endDate', { endDate });

    // If tenantId is provided, filter by tenant (for regular users)
    // If tenantId is null, get holidays from all tenants (for system-admin)
    if (tenantId) {
      query = query.andWhere('holiday.tenant_id = :tenantId', { tenantId });
    }

    return await query
      .orderBy('holiday.date', 'ASC')
      .getMany();
  }

  async isHoliday(tenantId: string | null, date: Date): Promise<boolean> {
    let whereCondition: any = {
      date: date,
      is_active: true,
    };

    // If tenantId is provided, filter by tenant (for regular users)
    // If tenantId is null, check across all tenants (for system-admin)
    if (tenantId) {
      whereCondition.tenant_id = tenantId;
    }

    const holiday = await this.holidayRepository.findOne({
      where: whereCondition,
    });

    return !!holiday;
  }
}
