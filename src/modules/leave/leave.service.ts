import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Leave } from 'src/entities/leave.entity';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { User } from '../../entities/user.entity';

@Injectable()
export class LeaveService {
  constructor(
    @InjectRepository(Leave)
    private leaveRepo: Repository<Leave>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  async createLeave(user_id: string, dto: CreateLeaveDto): Promise<Leave> {
    const leave = this.leaveRepo.create({ ...dto, user_id });
    return await this.leaveRepo.save(leave);
  }

  async getLeaves(user_id?: string): Promise<Leave[]> {
    if (user_id) {
      return this.leaveRepo.find({ where: { user_id } });
    }
    return this.leaveRepo.find();
  }

  async getAllLeaves(tenantId: string) {
 return this.leaveRepo.find({
  where: {
    user: {
      tenant_id: tenantId,
    },
  },
  relations: ['user'],
});
}

async updateStatus(id: string, status: string, adminTenantId: string): Promise<Leave> {
  const leave = await this.leaveRepo.findOne({ where: { id }, relations: ['user'] });

  if (!leave) throw new NotFoundException('Leave not found');

  if (leave.user.tenant_id !== adminTenantId) {
    throw new ForbiddenException('Access denied');
  }

  leave.status = status;
  return await this.leaveRepo.save(leave);
}
}
