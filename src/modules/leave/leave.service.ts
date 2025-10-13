import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { LeaveStatus } from '../../common/constants/enums';
import { Leave } from 'src/entities/leave.entity';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { User } from '../../entities/user.entity';
import { PaginationResponse } from '../../common/interfaces/pagination.interface';
import { Employee } from 'src/entities/employee.entity';

@Injectable()
export class LeaveService {
  constructor(
    @InjectRepository(Leave)
    private leaveRepo: Repository<Leave>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee> 
  ) {}

  async createLeave(user_id: string, dto: CreateLeaveDto): Promise<Leave> {
    const leave = this.leaveRepo.create({ ...dto, user_id });
    return await this.leaveRepo.save(leave);
  }

  // Helper method to calculate leaves taken in the last 12 months
  async getLeavesTakenInLast12Months(user_id: string): Promise<number> {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
    const now = new Date();
    
    // Get all APPROVED leaves for user within the range
    const leaves = await this.leaveRepo.createQueryBuilder('leave')
      .where('leave.user_id = :user_id', { user_id })
      .andWhere('leave.status = :status', { status: LeaveStatus.APPROVED })
      .andWhere('leave.from_date >= :start', { start: twelveMonthsAgo })
      .andWhere('leave.from_date <= :end', { end: now })
      .getMany();

    // Sum the leave days
    let totalDays = 0;
    for (const leave of leaves) {
      const from = new Date(leave.from_date);
      const to = new Date(leave.to_date);
      // Add 1 to include both from_date and to_date (inclusive dates)
      const days = Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      totalDays += days;
    }
    return totalDays;
  }

  async getLeaves(
    user_id?: string,
    page: number = 1
  ): Promise<{
    items: Leave[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    leavesLeft?: number;
    totalLeaves: number;
  }> {
    const limit = 10;
    const skip = (page - 1) * limit;
    let query = this.leaveRepo.createQueryBuilder('leave');
    if (user_id) {
      query = query.where('leave.user_id = :user_id', { user_id });
    }
    const [items, total] = await query
      .orderBy('leave.created_at', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();
    const totalPages = Math.ceil(total / limit);
    // Calculate leaves left
    let leavesLeft: number | undefined = undefined;
    if (user_id) {
      const taken = await this.getLeavesTakenInLast12Months(user_id);
      leavesLeft = 21 - taken;
      if (leavesLeft < 0) leavesLeft = 0;
    }
    return {
      items,
      total,
      page,
      limit,
      totalPages,
      ...(leavesLeft !== undefined ? { leavesLeft } : {}),
      totalLeaves: 21,
    };
  }

  async getAllLeaves(
    tenantId: string,
    page: number = 1
  ): Promise<{
    items: Leave[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const limit = 10;
    const skip = (page - 1) * limit;
    const [items, total] = await this.leaveRepo.findAndCount({
      where: {
        user: {
          tenant_id: tenantId,
        },
        status: In([LeaveStatus.PENDING, LeaveStatus.APPROVED, LeaveStatus.REJECTED]), 
      },
      relations: ['user'],
      order: { created_at: 'DESC' },
      skip,
      take: limit,
    });
    const totalPages = Math.ceil(total / limit);
    return {
      items,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async updateStatus(id: string, status: LeaveStatus, adminTenantId: string): Promise<Leave> {
    const leave = await this.leaveRepo.findOne({ where: { id }, relations: ['user'] });

    if (!leave) throw new NotFoundException('Leave not found');

    if (leave.user.tenant_id !== adminTenantId) {
      throw new ForbiddenException('Access denied');
    }

    leave.status = status;
    return await this.leaveRepo.save(leave);
  }

  async withdrawLeave(id: string, userId: string): Promise<Leave> {
    const leave = await this.leaveRepo.findOne({ where: { id } });

    if (!leave) throw new NotFoundException('Leave not found');

    
    if (leave.user_id !== userId) {
      throw new ForbiddenException('You can only withdraw your own leave requests');
    }

  
    if (leave.status !== LeaveStatus.PENDING) {
      throw new ForbiddenException('You can only withdraw pending leave requests');
    }

    leave.status = LeaveStatus.CANCELLED;
    return await this.leaveRepo.save(leave);
  }
  
  async getTotalLeavesForCurrentMonth(tenantId: string): Promise<{ totalLeaves: number }> {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); 
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

  
  private async getManagerTeamMemberUserIds(
    managerId: string,
    tenantId: string
  ): Promise<string[]> {
    const employees = await this.employeeRepo
      .createQueryBuilder('e')
      .leftJoin('e.user', 'u')
      .leftJoin('e.team', 't')
      .where('u.tenant_id = :tenantId', { tenantId })
      .andWhere('t.manager_id = :managerId', { managerId })
      .andWhere('e.user_id != :managerId', { managerId }) 
      .select(['e.user_id'])
      .getMany();

    return employees.map((e) => e.user_id);
  }

  async getTeamLeaves(
    managerId: string,
    tenantId: string,
    page: number = 1
  ): Promise<{
    items: Leave[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const limit = 10;
    const skip = (page - 1) * limit;


    const teamMemberUserIds = await this.employeeRepo
      .createQueryBuilder('employee')
      .leftJoin('employee.user', 'user')
      .leftJoin('employee.team', 'team')
      .where('user.tenant_id = :tenantId', { tenantId })
      .andWhere('team.manager_id = :managerId', { managerId })
      .andWhere('employee.user_id != :managerId', { managerId }) 
      .select(['employee.user_id'])
      .getRawMany();

    const userIds = teamMemberUserIds.map((item) => item.employee_user_id);

    if (userIds.length === 0) {
      return {
        items: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
      };
    }

    
    const [items, total] = await this.leaveRepo.findAndCount({
      where: {
        user_id: In(userIds),
        status: In([LeaveStatus.PENDING, LeaveStatus.APPROVED, LeaveStatus.REJECTED]),
      },
      relations: ['user'],
      order: { created_at: 'DESC' },
      skip,
      take: limit,
    });

    const totalPages = Math.ceil(total / limit);

    return {
      items,
      total,
      page,
      limit,
      totalPages,
    };
  }

  
  async getTeamMembersWithLeaveApplications(
    managerId: string,
    tenantId: string
  ): Promise<{
    teamMembers: Array<{
      user_id: string;
      first_name: string;
      last_name: string;
      email: string;
      profile_pic?: string;
      designation: string;
      department: string;
      hasAppliedForLeave: boolean;
      totalLeaveApplications: number;
    }>;
    totalMembers: number;
    membersWithLeave: number;
  }> {
    
    const teamMembers = await this.employeeRepo
      .createQueryBuilder('employee')
      .leftJoinAndSelect('employee.user', 'user')
      .leftJoinAndSelect('employee.designation', 'designation')
      .leftJoinAndSelect('designation.department', 'department')
      .leftJoin('employee.team', 'team')
      .where('user.tenant_id = :tenantId', { tenantId })
      .andWhere('team.manager_id = :managerId', { managerId })
      .andWhere('employee.user_id != :managerId', { managerId }) 
      .select([
        'employee.user_id',
        'user.first_name',
        'user.last_name',
        'user.email',
        'user.profile_pic',
        'designation.title',
        'department.name',
      ])
      .getMany();

  
    const teamMemberUserIds = teamMembers.map((member) => member.user_id);

  
    const leaveApplications = await this.leaveRepo
      .createQueryBuilder('leave')
      .where('leave.user_id IN (:...userIds)', { userIds: teamMemberUserIds })
      .andWhere('leave.status IN (:...statuses)', { statuses: [LeaveStatus.PENDING, LeaveStatus.APPROVED, LeaveStatus.REJECTED] })
      .select(['leave.user_id', 'COUNT(leave.id) as totalApplications'])
      .groupBy('leave.user_id')
      .getRawMany();

    
    const leaveCountMap = new Map();
    leaveApplications.forEach((item) => {
      leaveCountMap.set(item.leave_user_id, parseInt(item.totalapplications));
    });

  
    const transformedMembers = teamMembers.map((member) => {
      const leaveCount = leaveCountMap.get(member.user_id) || 0;
      return {
        user_id: member.user_id,
        first_name: member.user.first_name,
        last_name: member.user.last_name,
        email: member.user.email,
        profile_pic: member.user.profile_pic || undefined,
        designation: member.designation?.title || 'N/A',
        department: member.designation?.department?.name || 'N/A',
        hasAppliedForLeave: leaveCount > 0,
        totalLeaveApplications: leaveCount,
      };
    });

    const membersWithLeave = transformedMembers.filter(
      (member) => member.hasAppliedForLeave
    ).length;

    return {
      teamMembers: transformedMembers,
      totalMembers: transformedMembers.length,
      membersWithLeave,
    };
  }
}
