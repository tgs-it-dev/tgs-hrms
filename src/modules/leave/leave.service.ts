import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { LeaveStatus } from '../../common/constants/enums';
import { Leave } from 'src/entities/leave.entity';
import { LeaveType } from 'src/entities/leave-type.entity';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { User } from '../../entities/user.entity';
import { Employee } from 'src/entities/employee.entity';

@Injectable()
export class LeaveService {
  constructor(
    @InjectRepository(Leave)
    private leaveRepo: Repository<Leave>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(LeaveType)
    private readonly leaveTypeRepo: Repository<LeaveType>
  ) {}

  async createLeave(employeeId: string, tenantId: string, dto: CreateLeaveDto): Promise<Leave> {
    
    const leaveType = await this.leaveTypeRepo.findOne({
      where: { id: dto.leaveTypeId, tenantId, status: 'active' }
    });

    if (!leaveType) {
      throw new NotFoundException('Leave type not found');
    }

    
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day

    // Normalize dates to start of day for comparison
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);

    // Check if start date is in the past
    if (startDate < today) {
      throw new ForbiddenException('Leave cannot be applied for past dates');
    }

    if (endDate < startDate) {
      throw new ForbiddenException('End date cannot be before start date');
    }

    // Allow leave application for next year (max 1 year ahead from today)
    const maxFutureDate = new Date(today);
    maxFutureDate.setFullYear(maxFutureDate.getFullYear() + 1);
    
    if (startDate > maxFutureDate) {
      throw new ForbiddenException('Leave can only be applied up to 1 year in advance');
    }

    
    const overlappingLeave = await this.leaveRepo
      .createQueryBuilder('leave')
      .where('leave.employeeId = :employeeId', { employeeId })
      .andWhere('leave.tenantId = :tenantId', { tenantId })
      .andWhere('leave.status IN (:...statuses)', {
        statuses: [LeaveStatus.PENDING, LeaveStatus.APPROVED],
      })
      .andWhere('leave.startDate <= :endDate', { endDate })
      .andWhere('leave.endDate >= :startDate', { startDate })
      .getOne();

    if (overlappingLeave) {
      throw new ForbiddenException(
        'You already have a leave request that overlaps with these dates',
      );
    }

    // Calculate working days only (exclude weekends)
    const totalDays = this.calculateWorkingDays(startDate, endDate);

    if (totalDays <= 0) {
      throw new ForbiddenException('Leave cannot be applied only for weekends');
    }

    // NOTE:
    // Previously we were blocking leave requests when requested days exceeded available balance:
    //   if (totalDays > availableDays) throw ForbiddenException('Insufficient leave balance...');
    // Business requirement changed: request should still be allowed/approved
    // and any excess usage will simply be reflected as negative balance in reports.
    // const usedDays = await this.getUsedLeaveDays(employeeId, dto.leaveTypeId); // Not used - business requirement changed
    // const availableDays = leaveType.maxDaysPerYear - usedDays; // Not used - business requirement changed
    // We intentionally do NOT block when totalDays > availableDays anymore.

    const leave = this.leaveRepo.create({
      employeeId,
      leaveTypeId: dto.leaveTypeId,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      totalDays,
      reason: dto.reason,
      tenantId,
    });

    return await this.leaveRepo.save(leave);
  }



  async getLeavesTakenInLast12Months(user_id: string): Promise<number> {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
    const now = new Date();
    
    
    const leaves = await this.leaveRepo.createQueryBuilder('leave')
      .where('leave.employeeId = :user_id', { user_id })
      .andWhere('leave.status = :status', { status: LeaveStatus.APPROVED })
      .andWhere('leave.startDate >= :start', { start: twelveMonthsAgo })
      .andWhere('leave.startDate <= :end', { end: now })
      .getMany();

  
    let totalDays = 0;
    for (const leave of leaves) {
      totalDays += leave.totalDays;
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
    const limit = 25;
    const skip = (page - 1) * limit;

    let query = this.leaveRepo
      .createQueryBuilder('leave')
      .leftJoinAndSelect('leave.leaveType', 'leaveType')
      .leftJoinAndSelect('leave.approver', 'approver')
      .leftJoinAndSelect('leave.employee', 'employee');

    if (user_id) {
      query = query.where('leave.employeeId = :user_id', { user_id });
    }

    const [items, total] = await query
      .orderBy('leave.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const totalPages = Math.ceil(total / limit);
  
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
    page: number = 1,
    status?: string
  ): Promise<{
    items: Leave[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const limit = 25;
    const skip = (page - 1) * limit;
    
    const whereConditions: any = {
      tenantId,
    };

    if (status) {
      whereConditions.status = status;
    } else {
      whereConditions.status = In([LeaveStatus.PENDING, LeaveStatus.APPROVED, LeaveStatus.REJECTED]);
    }

    const [items, total] = await this.leaveRepo.findAndCount({
      where: whereConditions,
      relations: ['employee', 'leaveType', 'approver'],
      order: { createdAt: 'DESC' },
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

  async getLeaveById(id: string, employeeId: string, tenantId: string): Promise<Leave> {
    const leave = await this.leaveRepo.findOne({
      where: { id, tenantId },
      relations: ['employee', 'leaveType', 'approver'],
    });

    if (!leave) {
      throw new NotFoundException('Leave not found');
    }

    
    if (leave.employeeId !== employeeId) {
    
      const user = await this.userRepo.findOne({ where: { id: employeeId } });
      if (!user || !['admin', 'system-admin', 'hr-admin', 'manager'].includes(user.role as unknown as string)) {
        throw new ForbiddenException('Access denied');
      }
    }

    return leave;
  }

  async approveLeave(id: string, approverId: string, tenantId: string, remarks?: string): Promise<Leave> {
    const leave = await this.leaveRepo.findOne({
      where: { id, tenantId },
      relations: ['employee'],
    });

    if (!leave) {
      throw new NotFoundException('Leave not found');
    }

    if (leave.status !== LeaveStatus.PENDING) {
      throw new ForbiddenException('Only pending leaves can be approved');
    }

    leave.status = LeaveStatus.APPROVED;
    leave.approvedBy = approverId;
    leave.approvedAt = new Date();
    leave.remarks = remarks || '';

    return await this.leaveRepo.save(leave);
  }

  async rejectLeave(id: string, approverId: string, tenantId: string, remarks?: string): Promise<Leave> {
    const leave = await this.leaveRepo.findOne({
      where: { id, tenantId },
      relations: ['employee'],
    });

    if (!leave) {
      throw new NotFoundException('Leave not found');
    }

    if (leave.status !== LeaveStatus.PENDING) {
      throw new ForbiddenException('Only pending leaves can be rejected');
    }

    leave.status = LeaveStatus.REJECTED;
    leave.approvedBy = approverId;
    leave.approvedAt = new Date();
    leave.remarks = remarks || '';

    return await this.leaveRepo.save(leave);
  }

  async cancelLeave(id: string, employeeId: string): Promise<Leave> {
    const leave = await this.leaveRepo.findOne({
      where: { id },
    });

    if (!leave) {
      throw new NotFoundException('Leave not found');
    }

    if (leave.employeeId !== employeeId) {
      throw new ForbiddenException('You can only cancel your own leave requests');
    }

    if (leave.status !== LeaveStatus.PENDING) {
      throw new ForbiddenException('You can only cancel pending leave requests');
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
      .where('leave.tenantId = :tenantId', { tenantId })
      .andWhere('leave.createdAt >= :startOfMonth AND leave.createdAt <= :endOfMonth', {
        startOfMonth,
        endOfMonth,
      })
      .getCount();

    return { totalLeaves: leavesCount };
  }

  /**
   * Calculates number of working days (Mon–Fri) between two dates inclusive.
   * Weekends (Saturday, Sunday) are excluded from the count.
   */
  private calculateWorkingDays(startDate: Date, endDate: Date): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    // Normalize time to midnight to avoid timezone/time issues
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    let workingDays = 0;
    while (start <= end) {
      const day = start.getDay(); // 0 = Sun, 6 = Sat
      if (day !== 0 && day !== 6) {
        workingDays++;
      }
      start.setDate(start.getDate() + 1);
    }

    return workingDays;
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

    // Fetch team members - same approach as attendance service
    const teamMembers = await this.employeeRepo
      .createQueryBuilder('employee')
      .leftJoin('employee.user', 'user')
      .leftJoin('employee.team', 'team')
      .where('user.tenant_id = :tenantId', { tenantId })
      .andWhere('team.manager_id = :managerId', { managerId })
      .andWhere('employee.user_id != :managerId', { managerId })
      .andWhere('employee.team_id IS NOT NULL')
      .getMany();

    const userIds = teamMembers.map((member) => member.user_id);

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
        employeeId: In(userIds),
        status: In([LeaveStatus.PENDING, LeaveStatus.APPROVED, LeaveStatus.REJECTED]),
      },
      relations: ['employee', 'leaveType', 'approver'],
      order: { createdAt: 'DESC' },
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
      .where('leave.employeeId IN (:...userIds)', { userIds: teamMemberUserIds })
      .andWhere('leave.status IN (:...statuses)', { statuses: [LeaveStatus.PENDING, LeaveStatus.APPROVED, LeaveStatus.REJECTED] })
      .select(['leave.employeeId', 'COUNT(leave.id) as totalApplications'])
      .groupBy('leave.employeeId')
      .getRawMany();

    
    const leaveCountMap = new Map();
    leaveApplications.forEach((item) => {
      leaveCountMap.set(item.leave_employeeId, parseInt(item.totalapplications));
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
