import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
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
    private readonly employeeRepo: Repository<Employee> // NEW
  ) {}

  async createLeave(user_id: string, dto: CreateLeaveDto): Promise<Leave> {
    const leave = this.leaveRepo.create({ ...dto, user_id });
    return await this.leaveRepo.save(leave);
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
    return {
      items,
      total,
      page,
      limit,
      totalPages,
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
        status: In(['pending', 'Approved', 'Rejected']), // Exclude withdrawn leaves
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

  async updateStatus(id: string, status: string, adminTenantId: string): Promise<Leave> {
    const leave = await this.leaveRepo.findOne({ where: { id }, relations: ['user'] });

    if (!leave) throw new NotFoundException('Leave not found');

    if (leave.user.tenant_id !== adminTenantId) {
      throw new ForbiddenException('Access denied');
    }

    leave.status = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
    return await this.leaveRepo.save(leave);
  }

  async withdrawLeave(id: string, userId: string): Promise<Leave> {
    const leave = await this.leaveRepo.findOne({ where: { id } });

    if (!leave) throw new NotFoundException('Leave not found');

    // Check if the user owns this leave request
    if (leave.user_id !== userId) {
      throw new ForbiddenException('You can only withdraw your own leave requests');
    }

    // Check if the leave is still pending (can't withdraw approved/rejected/withdrawn leaves)
    if (leave.status !== 'pending') {
      throw new ForbiddenException('You can only withdraw pending leave requests');
    }

    leave.status = 'withdrawn';
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

  // NEW: helper to get all team member user_ids for a manager in a tenant
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
      .andWhere('e.user_id != :managerId', { managerId }) // exclude manager themself
      .select(['e.user_id'])
      .getMany();

    return employees.map((e) => e.user_id);
  }

  // NEW: get team leaves (manager scoped)
  // Get team leaves for managers (corrected version)
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

    // Get team member user IDs using a single query
    const teamMemberUserIds = await this.employeeRepo
      .createQueryBuilder('employee')
      .leftJoin('employee.user', 'user')
      .leftJoin('employee.team', 'team')
      .where('user.tenant_id = :tenantId', { tenantId })
      .andWhere('team.manager_id = :managerId', { managerId })
      .andWhere('employee.user_id != :managerId', { managerId }) // Exclude manager
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

    // Get leave requests for team members (exclude withdrawn leaves)
    const [items, total] = await this.leaveRepo.findAndCount({
      where: {
        user_id: In(userIds),
        status: In(['pending', 'Approved', 'Rejected']), // Exclude withdrawn leaves
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

  // NEW: Get simple list of team members who have applied for leave (without detailed leave info)
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
    // Get all team members for the manager
    const teamMembers = await this.employeeRepo
      .createQueryBuilder('employee')
      .leftJoinAndSelect('employee.user', 'user')
      .leftJoinAndSelect('employee.designation', 'designation')
      .leftJoinAndSelect('designation.department', 'department')
      .leftJoin('employee.team', 'team')
      .where('user.tenant_id = :tenantId', { tenantId })
      .andWhere('team.manager_id = :managerId', { managerId })
      .andWhere('employee.user_id != :managerId', { managerId }) // Exclude manager
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

    // Get user IDs of team members
    const teamMemberUserIds = teamMembers.map((member) => member.user_id);

    // Get leave applications count for each team member (exclude withdrawn leaves)
    const leaveApplications = await this.leaveRepo
      .createQueryBuilder('leave')
      .where('leave.user_id IN (:...userIds)', { userIds: teamMemberUserIds })
      .andWhere('leave.status IN (:...statuses)', { statuses: ['pending', 'Approved', 'Rejected'] })
      .select(['leave.user_id', 'COUNT(leave.id) as totalApplications'])
      .groupBy('leave.user_id')
      .getRawMany();

    // Create a map of user_id to leave count
    const leaveCountMap = new Map();
    leaveApplications.forEach((item) => {
      leaveCountMap.set(item.leave_user_id, parseInt(item.totalapplications));
    });

    // Transform the data
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
