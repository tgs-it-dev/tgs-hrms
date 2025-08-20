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
  // Get total leaves for the current month for a tenant
  async getTotalLeavesForCurrentMonth(tenantId: string): Promise<{ totalLeaves: number }> {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-based
    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

    const leavesCount = await this.leaveRepo
      .createQueryBuilder('leave')
      .leftJoin('leave.user', 'user')
      .where('user.tenant_id = :tenantId', { tenantId })
      .andWhere('leave.created_at >= :startOfMonth AND leave.created_at <= :endOfMonth', {
        startOfMonth,
        endOfMonth,
      })
      .getCount();

    return { totalLeaves: leavesCount };
  }

}
