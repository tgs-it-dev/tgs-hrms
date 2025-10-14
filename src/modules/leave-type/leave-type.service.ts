import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeaveType } from '../../entities/leave-type.entity';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import { UpdateLeaveTypeDto } from './dto/update-leave-type.dto';
import { PaginationResponse } from '../../common/interfaces/pagination.interface';

@Injectable()
export class LeaveTypeService {
  constructor(
    @InjectRepository(LeaveType)
    private leaveTypeRepo: Repository<LeaveType>,
  ) {}

  async create(createLeaveTypeDto: CreateLeaveTypeDto, tenantId: string, createdBy: string): Promise<LeaveType> {
    const leaveType = this.leaveTypeRepo.create({
      ...createLeaveTypeDto,
      tenantId,
      createdBy,
    });
    return await this.leaveTypeRepo.save(leaveType);
  }

  async findAll(tenantId: string, page: number = 1, limit: number = 10): Promise<PaginationResponse<LeaveType>> {
    const skip = (page - 1) * limit;
    const [items, total] = await this.leaveTypeRepo.findAndCount({
      where: { tenantId, status: 'active' },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, tenantId: string): Promise<LeaveType> {
    const leaveType = await this.leaveTypeRepo.findOne({
      where: { id, tenantId },
    });

    if (!leaveType) {
      throw new NotFoundException('Leave type not found');
    }

    return leaveType;
  }

  async update(id: string, updateLeaveTypeDto: UpdateLeaveTypeDto, tenantId: string): Promise<LeaveType> {
    const leaveType = await this.findOne(id, tenantId);
    
    Object.assign(leaveType, updateLeaveTypeDto);
    return await this.leaveTypeRepo.save(leaveType);
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const leaveType = await this.findOne(id, tenantId);
    
    // Soft delete by setting status to inactive
    leaveType.status = 'inactive';
    await this.leaveTypeRepo.save(leaveType);
  }
}
