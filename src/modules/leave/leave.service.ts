import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { LeaveStatus, NotificationType, UserRole } from '../../common/constants/enums';
import { Leave } from 'src/entities/leave.entity';
import { LeaveType } from 'src/entities/leave-type.entity';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { CreateLeaveForEmployeeDto } from './dto/create-leave-for-employee.dto';
import { EditLeaveDto } from './dto/update-leave.dto';
import { User } from '../../entities/user.entity';
import { Employee } from 'src/entities/employee.entity';
import { LeaveFileUploadService } from './services/leave-file-upload.service';
import { NotificationService } from '../notification/notification.service';
import { NotificationGateway } from '../notification/notification.gateway';
import { Team } from '../../entities/team.entity';

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
    private readonly leaveTypeRepo: Repository<LeaveType>,
    @InjectRepository(Team)
    private readonly teamRepo: Repository<Team>,
    private readonly leaveFileUploadService: LeaveFileUploadService,
    private readonly notificationService: NotificationService,
    private readonly notificationGateway: NotificationGateway,
  ) { }

  /**
   * Roles whose leave applications go directly to admin (PROCESSING), skipping manager approval.
   */
  private isDirectToAdminRole(roleName: string | null | undefined): boolean {
    if (!roleName) return false;
    const r = roleName.trim().toLowerCase();
    return r === UserRole.MANAGER || r === UserRole.HR_ADMIN || r === UserRole.NETWORK_ADMIN;
  }

  async createLeave(
    employeeId: string,
    tenantId: string,
    dto: CreateLeaveDto,
    files?: Express.Multer.File[],
  ): Promise<Leave> {

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

    // Allow past dates - employees and admins can apply for leave with past dates
    // Removed validation: if (startDate < today) - now allows past dates

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
        statuses: [LeaveStatus.PENDING, LeaveStatus.PROCESSING, LeaveStatus.APPROVED],
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
    // We intentionally do NOT block when totalDays > availableDays anymore.

    const applicantUser = await this.userRepo.findOne({
      where: { id: employeeId },
      relations: ['role'],
    });
    const directToAdmin = this.isDirectToAdminRole(applicantUser?.role?.name);
    const initialStatus = directToAdmin ? LeaveStatus.PROCESSING : LeaveStatus.PENDING;

    const leave = this.leaveRepo.create({
      employeeId,
      leaveTypeId: dto.leaveTypeId,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      totalDays,
      reason: dto.reason,
      tenantId,
      documents: [],
      status: initialStatus,
    });

    const savedLeave = await this.leaveRepo.save(leave);

    if (files && files.length > 0) {
      const documentUrls = await this.leaveFileUploadService.uploadLeaveDocuments(
        files,
        savedLeave.id,
      );
      savedLeave.documents = documentUrls;
      await this.leaveRepo.save(savedLeave);
    }

    try {
      const employee = await this.employeeRepo.findOne({
        where: { user_id: employeeId },
        relations: ['team', 'user'],
      });
      const employeeName = `${employee?.user?.first_name || ''} ${employee?.user?.last_name || ''}`.trim();
      const message = directToAdmin
        ? `Leave request from ${employeeName || 'staff'} is pending admin approval`
        : `Leave request pending approval from ${employeeName || 'an employee'}`;
      const payload = {
        related_entity_type: 'leave' as const,
        related_entity_id: savedLeave.id,
      };

      if (directToAdmin) {
        const adminUserIds = await this.getTenantAdminAndHrAdminUserIds(tenantId);
        for (const adminId of adminUserIds) {
          const notification = await this.notificationService.create(
            adminId,
            tenantId,
            message,
            NotificationType.LEAVE,
            { relatedEntityType: 'leave', relatedEntityId: savedLeave.id },
          );
          this.notificationGateway.sendToUser(adminId, 'new_notification', {
            id: notification.id,
            message: notification.message,
            type: notification.type,
            ...payload,
            created_at: notification.created_at,
          });
        }
      } else {
        const managerId = employee?.team?.manager_id;
        if (employee?.team && managerId && managerId !== employeeId) {
          const notification = await this.notificationService.create(
            managerId,
            tenantId,
            message,
            NotificationType.LEAVE,
            { relatedEntityType: 'leave', relatedEntityId: savedLeave.id },
          );
          this.notificationGateway.sendToUser(managerId, 'new_notification', {
            id: notification.id,
            message: notification.message,
            type: notification.type,
            ...payload,
            created_at: notification.created_at,
          });
        }
      }
    } catch (error) {
      console.error('Failed to create leave application notification:', error);
    }

    return savedLeave;
  }

  /**
   * Get user IDs of tenant users with role admin, hr-admin, or system-admin (for pending leave notifications).
   */
  private async getTenantAdminAndHrAdminUserIds(tenantId: string): Promise<string[]> {
    const users = await this.userRepo
      .createQueryBuilder('user')
      .innerJoin('user.role', 'role')
      .where('user.tenant_id = :tenantId', { tenantId })
      .andWhere('role.name IN (:...names)', {
        names: ['admin', 'hr-admin', 'system-admin'],
      })
      .select('user.id')
      .getRawMany<{ user_id: string }>();
    return users.map((r) => r.user_id);
  }

  /**
   * Create leave request for an employee (Admin/HR Admin only)
   * Validates that the employee belongs to the same tenant
   */
  async createLeaveForEmployee(
    requesterId: string,
    tenantId: string,
    dto: CreateLeaveForEmployeeDto,
    files?: Express.Multer.File[],
  ): Promise<Leave> {
    const employeeUser = await this.userRepo.findOne({
      where: { id: dto.employeeId, tenant_id: tenantId },
      relations: ['role'],
    });

    if (!employeeUser) {
      throw new NotFoundException(
        'Employee not found or does not belong to your tenant',
      );
    }

    const directToAdmin = this.isDirectToAdminRole(employeeUser.role?.name);
    const initialStatus = directToAdmin ? LeaveStatus.PROCESSING : LeaveStatus.PENDING;

    // Use the existing createLeave logic but with the specified employeeId
    // We'll reuse the validation and creation logic
    const leaveType = await this.leaveTypeRepo.findOne({
      where: { id: dto.leaveTypeId, tenantId, status: 'active' },
    });

    if (!leaveType) {
      throw new NotFoundException('Leave type not found');
    }

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);

    // Allow past dates - admins can apply for leave with past dates on behalf of employees

    if (endDate < startDate) {
      throw new ForbiddenException('End date cannot be before start date');
    }

    // Allow leave application for next year (max 1 year ahead from today)
    const maxFutureDate = new Date(today);
    maxFutureDate.setFullYear(maxFutureDate.getFullYear() + 1);

    if (startDate > maxFutureDate) {
      throw new ForbiddenException('Leave can only be applied up to 1 year in advance');
    }

    // Check for overlapping leaves
    const overlappingLeave = await this.leaveRepo
      .createQueryBuilder('leave')
      .where('leave.employeeId = :employeeId', { employeeId: dto.employeeId })
      .andWhere('leave.tenantId = :tenantId', { tenantId })
      .andWhere('leave.status IN (:...statuses)', {
        statuses: [LeaveStatus.PENDING, LeaveStatus.PROCESSING, LeaveStatus.APPROVED],
      })
      .andWhere('leave.startDate <= :endDate', { endDate })
      .andWhere('leave.endDate >= :startDate', { startDate })
      .getOne();

    if (overlappingLeave) {
      throw new ForbiddenException(
        'Employee already has a leave request that overlaps with these dates',
      );
    }

    // Calculate working days only (exclude weekends)
    const totalDays = this.calculateWorkingDays(startDate, endDate);

    if (totalDays <= 0) {
      throw new ForbiddenException('Leave cannot be applied only for weekends');
    }

    const leave = this.leaveRepo.create({
      employeeId: dto.employeeId,
      leaveTypeId: dto.leaveTypeId,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      totalDays,
      reason: dto.reason,
      tenantId,
      documents: [],
      status: initialStatus,
    });

    const savedLeave = await this.leaveRepo.save(leave);

    if (files && files.length > 0) {
      const documentUrls = await this.leaveFileUploadService.uploadLeaveDocuments(
        files,
        savedLeave.id,
      );
      savedLeave.documents = documentUrls;
      await this.leaveRepo.save(savedLeave);
    }

    try {
      const employee = await this.employeeRepo.findOne({
        where: { user_id: dto.employeeId },
        relations: ['team', 'user'],
      });
      const employeeName = `${employee?.user?.first_name || ''} ${employee?.user?.last_name || ''}`.trim();
      const message = directToAdmin
        ? `Leave request from ${employeeName || 'staff'} is pending admin approval`
        : `Leave request pending approval from ${employeeName || 'an employee'}`;
      const payload = {
        related_entity_type: 'leave' as const,
        related_entity_id: savedLeave.id,
      };

      if (directToAdmin) {
        const adminUserIds = await this.getTenantAdminAndHrAdminUserIds(tenantId);
        for (const adminId of adminUserIds) {
          const notification = await this.notificationService.create(
            adminId,
            tenantId,
            message,
            NotificationType.LEAVE,
            { relatedEntityType: 'leave', relatedEntityId: savedLeave.id },
          );
          this.notificationGateway.sendToUser(adminId, 'new_notification', {
            id: notification.id,
            message: notification.message,
            type: notification.type,
            ...payload,
            created_at: notification.created_at,
          });
        }
      } else if (employee?.team?.manager_id && employee.team.manager_id !== dto.employeeId) {
        const managerId = employee.team.manager_id;
        const notification = await this.notificationService.create(
          managerId,
          tenantId,
          message,
          NotificationType.LEAVE,
          { relatedEntityType: 'leave', relatedEntityId: savedLeave.id },
        );
        this.notificationGateway.sendToUser(managerId, 'new_notification', {
          id: notification.id,
          message: notification.message,
          type: notification.type,
          ...payload,
          created_at: notification.created_at,
        });
      }
    } catch (error) {
      console.error('Failed to create leave notification (createLeaveForEmployee):', error);
    }

    return savedLeave;
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
    page: number = 1,
    tenantId?: string,
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

    if (tenantId) {
      query = query.andWhere('leave.tenantId = :tenantId', { tenantId });
    }

    const [items, total] = await query
      .orderBy('leave.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const totalPages = Math.ceil(total / limit);

    let leavesLeft: number | undefined = undefined;
    let totalEntitlement = 21; // Default fallback

    if (tenantId) {
      const leaveTypes = await this.leaveTypeRepo.find({
        where: { tenantId, status: 'active' },
      });
      if (leaveTypes.length > 0) {
        totalEntitlement = leaveTypes.reduce((sum, lt) => sum + lt.maxDaysPerYear, 0);
      }
    }

    if (user_id) {
      const taken = await this.getLeavesTakenInLast12Months(user_id);
      leavesLeft = totalEntitlement - taken;
      // We allow negative balance as per requirement
    }

    return {
      items,
      total,
      page,
      limit,
      totalPages,
      ...(leavesLeft !== undefined ? { leavesLeft } : {}),
      totalLeaves: totalEntitlement,
    };
  }

  async getAllLeaves(
    tenantId: string,
    page: number = 1,
    status?: string,
    month?: number,
    year?: number
  ): Promise<{
    items: Leave[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const limit = 25;
    const skip = (page - 1) * limit;

    const queryBuilder = this.leaveRepo
      .createQueryBuilder('leave')
      .leftJoinAndSelect('leave.employee', 'employee')
      .leftJoinAndSelect('leave.leaveType', 'leaveType')
      .leftJoinAndSelect('leave.approver', 'approver')
      .where('leave.tenantId = :tenantId', { tenantId });

    if (status) {
      queryBuilder.andWhere('leave.status = :status', { status });
    } else {
      // Admin sees only PROCESSING (awaiting their approval), APPROVED, REJECTED — not PENDING (manager-only)
      queryBuilder.andWhere('leave.status IN (:...statuses)', {
        statuses: [LeaveStatus.PROCESSING, LeaveStatus.APPROVED, LeaveStatus.REJECTED],
      });
    }

    // Filter by month and year if provided
    if (month && month >= 1 && month <= 12) {
      const targetYear = year ?? new Date().getFullYear();
      const startDate = new Date(targetYear, month - 1, 1);
      const endDate = new Date(targetYear, month, 0, 23, 59, 59, 999);

      // Filter leaves where startDate falls within the specified month
      queryBuilder.andWhere('leave.startDate >= :startDate', { startDate });
      queryBuilder.andWhere('leave.startDate <= :endDate', { endDate });
    } else if (year) {
      // If only year is provided, filter by the entire year
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31, 23, 59, 59, 999);

      queryBuilder.andWhere('leave.startDate >= :startDate', { startDate });
      queryBuilder.andWhere('leave.startDate <= :endDate', { endDate });
    }

    const [items, total] = await queryBuilder
      .orderBy('leave.createdAt', 'DESC')
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

    const isPending = leave.status === LeaveStatus.PENDING;
    const isProcessing = leave.status === LeaveStatus.PROCESSING;
    if (!isPending && !isProcessing) {
      throw new ForbiddenException('Only pending or processing leaves can be approved');
    }

    const employeeRecord = await this.employeeRepo.findOne({
      where: { user_id: leave.employeeId },
      relations: ['team'],
    });
    const managerId = employeeRecord?.team?.manager_id ?? null;
    const isApproverManager = Boolean(managerId && approverId === managerId);
    const isApproverAdmin = await this.isUserAdmin(approverId);

    if (isPending && isApproverManager) {
      // Manager approves: status → PROCESSING; notify employee + admin/hr (exclude approver — actor never gets own action's notification)
      leave.status = LeaveStatus.PROCESSING;
      leave.approvedBy = approverId;
      leave.approvedAt = new Date();
      leave.remarks = remarks || '';
      const saved = await this.leaveRepo.save(leave);

      try {
        const payload = { related_entity_type: 'leave' as const, related_entity_id: saved.id };
        // Employee-only: create and send only to leave.employeeId
        const empNotif = await this.notificationService.create(
          leave.employeeId,
          tenantId,
          'Your leave has been approved by manager and is now in processing',
          NotificationType.LEAVE,
          { relatedEntityType: 'leave', relatedEntityId: saved.id },
        );
        this.notificationGateway.sendToUser(leave.employeeId, 'new_notification', {
          id: empNotif.id,
          message: empNotif.message,
          type: empNotif.type,
          ...payload,
          created_at: empNotif.created_at,
        });
      } catch (error) {
        console.error('Failed to create leave approval notifications:', error);
      }
      return saved;
    }

    if ((isPending && isApproverAdmin) || (isProcessing && isApproverAdmin)) {
      // Only admin can do final approval (hr-admin cannot approve leaves)
      leave.status = LeaveStatus.APPROVED;
      leave.approvedBy = approverId;
      leave.approvedAt = new Date();
      leave.remarks = remarks || '';
      const saved = await this.leaveRepo.save(leave);

      try {
        // Employee-only: create and send only to leave.employeeId; never to admin or manager
        const message = 'Admin/HR has approved your leave';
        const notification = await this.notificationService.create(
          leave.employeeId,
          tenantId,
          message,
          NotificationType.LEAVE,
          { relatedEntityType: 'leave', relatedEntityId: saved.id },
        );
        this.notificationGateway.sendToUser(leave.employeeId, 'new_notification', {
          id: notification.id,
          message: notification.message,
          type: notification.type,
          related_entity_type: 'leave',
          related_entity_id: saved.id,
          created_at: notification.created_at,
        });
      } catch (error) {
        console.error('Failed to create leave approval notification:', error);
      }
      return saved;
    }

    if (isProcessing && isApproverManager) {
      throw new ForbiddenException('Leave is already in processing; pending admin approval');
    }
    throw new ForbiddenException('You are not authorized to approve this leave');
  }

  /** Only admin or system-admin can approve/reject leaves (final approval). HR-admin cannot. */
  private async isUserAdmin(userId: string): Promise<boolean> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['role'],
    });
    const roleName = user?.role?.name?.toLowerCase();
    return roleName === 'admin' || roleName === 'system-admin';
  }

  async rejectLeave(id: string, approverId: string, tenantId: string, remarks?: string): Promise<Leave> {
    const leave = await this.leaveRepo.findOne({
      where: { id, tenantId },
      relations: ['employee'],
    });

    if (!leave) {
      throw new NotFoundException('Leave not found');
    }

    const canReject =
      leave.status === LeaveStatus.PENDING || leave.status === LeaveStatus.PROCESSING;
    if (!canReject) {
      throw new ForbiddenException('Only pending or processing leaves can be rejected');
    }

    leave.status = LeaveStatus.REJECTED;
    leave.approvedBy = approverId;
    leave.approvedAt = new Date();
    leave.remarks = remarks || '';

    const saved = await this.leaveRepo.save(leave);

    // Employee-only: notify only leave.employeeId; never to approver (manager/admin)
    try {
      const notification = await this.notificationService.create(
        leave.employeeId,
        tenantId,
        'Your leave request was rejected',
        NotificationType.LEAVE,
        { relatedEntityType: 'leave', relatedEntityId: saved.id },
      );
      this.notificationGateway.sendToUser(leave.employeeId, 'new_notification', {
        id: notification.id,
        message: notification.message,
        type: notification.type,
        related_entity_type: 'leave',
        related_entity_id: saved.id,
        created_at: notification.created_at,
      });
    } catch (error) {
      // Don't fail rejection if notification fails
      console.error('Failed to create leave rejection notification:', error);
    }

    return saved;
  }

  /**
   * Allows a manager to add or update remarks on a team member's leave
   * request without changing its approval status. Final approval is still
   * handled by admin/HR as per existing business rules.
   */
  async addManagerRemarks(
    id: string,
    managerId: string,
    tenantId: string,
    remarks?: string
  ): Promise<Leave> {
    const leave = await this.leaveRepo.findOne({
      where: { id, tenantId },
      relations: ['employee'],
    });

    if (!leave) {
      throw new NotFoundException('Leave not found');
    }

    // Only allow remarks while leave is pending
    if (leave.status !== LeaveStatus.PENDING) {
      throw new ForbiddenException('Manager can only add remarks on pending leave requests');
    }

    // Ensure the leave belongs to one of the manager's team members
    const teamMember = await this.employeeRepo
      .createQueryBuilder('employee')
      .leftJoin('employee.user', 'user')
      .leftJoin('employee.team', 'team')
      .where('user.id = :employeeUserId', { employeeUserId: leave.employeeId })
      .andWhere('user.tenant_id = :tenantId', { tenantId })
      .andWhere('team.manager_id = :managerId', { managerId })
      .andWhere('employee.team_id IS NOT NULL')
      .getOne();

    if (!teamMember) {
      throw new ForbiddenException('You can only add remarks for your own team members\' leaves');
    }

    leave.managerRemarks = remarks || '';

    return await this.leaveRepo.save(leave);
  }

  async cancelLeave(
    id: string,
    employeeId: string,
    tenantId?: string,
    requesterRole?: string,
  ): Promise<Leave> {
    const leave = await this.leaveRepo.findOne({
      where: tenantId ? { id, tenantId } : { id },
    });

    if (!leave) {
      throw new NotFoundException('Leave not found');
    }

    // Check ownership - allow if employee owns it OR if requester is admin/hr-admin
    const isAdminOrHrAdmin = requesterRole && ['admin', 'hr-admin', 'system-admin'].includes(requesterRole.toLowerCase());

    if (leave.employeeId !== employeeId && !isAdminOrHrAdmin) {
      throw new ForbiddenException('You can only cancel your own leave requests');
    }

    // Admin/HR Admin can cancel pending leaves, employees can only cancel their own pending leaves
    if (leave.status !== LeaveStatus.PENDING) {
      throw new ForbiddenException('You can only cancel pending leave requests');
    }

    leave.status = LeaveStatus.CANCELLED;
    return await this.leaveRepo.save(leave);
  }

  async removeLeaveDocument(
    leaveId: string,
    documentUrl: string,
    employeeId: string,
    tenantId: string,
    requesterRole?: string,
  ): Promise<Leave> {
    const leave = await this.leaveRepo.findOne({
      where: { id: leaveId, tenantId },
      relations: ['leaveType'],
    });

    if (!leave) {
      throw new NotFoundException('Leave not found');
    }

    const isAdminOrHrAdmin = requesterRole && ['admin', 'hr-admin', 'system-admin'].includes(requesterRole.toLowerCase());
    if (leave.employeeId !== employeeId && !isAdminOrHrAdmin) {
      throw new ForbiddenException('You can only edit your own leave requests');
    }

    const docs = leave.documents || [];
    if (!docs.includes(documentUrl)) {
      throw new NotFoundException('Document not found on this leave');
    }

    leave.documents = docs.filter((d) => d !== documentUrl);
    await this.leaveFileUploadService.deleteLeaveDocument(documentUrl);
    const saved = await this.leaveRepo.save(leave);
    const updated = await this.leaveRepo.findOne({
      where: { id: leaveId, tenantId },
      relations: ['leaveType', 'employee', 'approver'],
    });
    return updated ?? saved;
  }

  /**
   * Edit a leave request with conditional restrictions:
   * - If leave is not approved: can edit all fields
   * - If leave is approved: can only edit/update documents
   * - Admin/HR Admin can edit leaves for any employee in their tenant
   */
  async editLeave(
    id: string,
    employeeId: string,
    tenantId: string,
    dto: EditLeaveDto,
    files?: Express.Multer.File[],
    requesterRole?: string,
  ): Promise<Leave> {
    const leave = await this.leaveRepo.findOne({
      where: { id, tenantId },
      relations: ['leaveType'],
    });

    if (!leave) {
      throw new NotFoundException('Leave not found');
    }

    // Check ownership - allow if employee owns it OR if requester is admin/hr-admin
    const isAdminOrHrAdmin = requesterRole && ['admin', 'hr-admin', 'system-admin'].includes(requesterRole.toLowerCase());

    if (leave.employeeId !== employeeId && !isAdminOrHrAdmin) {
      throw new ForbiddenException('You can only edit your own leave requests');
    }

    // If leave is approved, only allow document updates
    if (leave.status === LeaveStatus.APPROVED) {
      // Check if user is trying to edit non-document fields
      if (dto.leaveTypeId || dto.startDate || dto.endDate || dto.reason) {
        throw new ForbiddenException(
          'Cannot edit leave details after approval. Only documents can be updated.',
        );
      }

      // Handle document update/removal
      if (dto.documentsToRemove && Array.isArray(dto.documentsToRemove) && dto.documentsToRemove.length > 0) {
        leave.documents = (leave.documents || []).filter(doc => !dto.documentsToRemove!.includes(doc));
        await this.leaveFileUploadService.deleteLeaveDocuments(dto.documentsToRemove);
      }
      // If provided, replace all documents (edit to keep only provided), instead of just adding new files
      if (dto.documentsToRemove && leave.documents && leave.documents.length === 0 && !files?.length) {
        // If all documents are removed, nothing else needed
        const savedLeave = await this.leaveRepo.save(leave);
        const updatedLeave = await this.leaveRepo.findOne({
          where: { id: savedLeave.id, tenantId },
          relations: ['leaveType', 'employee', 'approver'],
        });
        return updatedLeave || savedLeave;
      }
      // Add new documents
      if (files && files.length > 0) {
        const newDocumentUrls = await this.leaveFileUploadService.uploadLeaveDocuments(
          files,
          leave.id,
        );
        leave.documents = [...(leave.documents || []), ...newDocumentUrls];
      }
      const savedLeave = await this.leaveRepo.save(leave);
      const updatedLeave = await this.leaveRepo.findOne({
        where: { id: savedLeave.id, tenantId },
        relations: ['leaveType', 'employee', 'approver'],
      });
      return updatedLeave || savedLeave;
    }

    // For non-approved leaves, allow editing all fields
    // Validate leave type if being changed
    if (dto.leaveTypeId !== undefined && dto.leaveTypeId !== null && dto.leaveTypeId !== '') {
      // Trim and validate the leave type ID
      const newLeaveTypeId = String(dto.leaveTypeId).trim();

      // Always validate the leave type exists
      const leaveType = await this.leaveTypeRepo.findOne({
        where: { id: newLeaveTypeId, tenantId, status: 'active' },
      });

      if (!leaveType) {
        throw new NotFoundException('Leave type not found');
      }

      // Update leaveTypeId - always update if provided (even if same, ensures it's saved)
      leave.leaveTypeId = newLeaveTypeId;
      // Clear the cached relation so it reloads with the new leaveType
      leave.leaveType = null as any;
    }

    // Update dates if provided (partial updates allowed - can update only startDate or only endDate)
    if (dto.startDate !== undefined || dto.endDate !== undefined) {
      // Use provided date or keep existing date
      const startDate = dto.startDate ? new Date(dto.startDate) : new Date(leave.startDate);
      const endDate = dto.endDate ? new Date(dto.endDate) : new Date(leave.endDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(0, 0, 0, 0);

      // Allow past dates - employees and admins can edit leave with past dates
      // Removed validation: if (startDate < today) - now allows past dates

      // Validate that end date is not before start date
      if (endDate < startDate) {
        throw new ForbiddenException('End date cannot be before start date');
      }

      // Validate future date limit (only if startDate is being changed)
      if (dto.startDate) {
        const maxFutureDate = new Date(today);
        maxFutureDate.setFullYear(maxFutureDate.getFullYear() + 1);

        if (startDate > maxFutureDate) {
          throw new ForbiddenException('Leave can only be applied up to 1 year in advance');
        }
      }

      // Check for overlapping leaves (excluding current leave)
      const overlappingLeave = await this.leaveRepo
        .createQueryBuilder('leave')
        .where('leave.employeeId = :employeeId', { employeeId })
        .andWhere('leave.tenantId = :tenantId', { tenantId })
        .andWhere('leave.id != :currentLeaveId', { currentLeaveId: id })
        .andWhere('leave.status IN (:...statuses)', {
          statuses: [LeaveStatus.PENDING, LeaveStatus.PROCESSING, LeaveStatus.APPROVED],
        })
        .andWhere('leave.startDate <= :endDate', { endDate })
        .andWhere('leave.endDate >= :startDate', { startDate })
        .getOne();

      if (overlappingLeave) {
        throw new ForbiddenException(
          'You already have a leave request that overlaps with these dates',
        );
      }

      // Only update the fields that were provided
      if (dto.startDate !== undefined) {
        leave.startDate = startDate;
      }
      if (dto.endDate !== undefined) {
        leave.endDate = endDate;
      }

      // Recalculate total days with the final dates (after updates)
      leave.totalDays = this.calculateWorkingDays(leave.startDate, leave.endDate);

      if (leave.totalDays <= 0) {
        throw new ForbiddenException('Leave cannot be applied only for weekends');
      }
    }

    // Update reason if provided
    if (dto.reason !== undefined) {
      leave.reason = dto.reason;
    }

    // Remove documents if requested
    if (dto.documentsToRemove && Array.isArray(dto.documentsToRemove) && dto.documentsToRemove.length > 0) {
      leave.documents = (leave.documents || []).filter(doc => !dto.documentsToRemove!.includes(doc));
      await this.leaveFileUploadService.deleteLeaveDocuments(dto.documentsToRemove);
    }

    // If user intends to only keep certain documents, support full replacement logic. If client sends an explicit new array, replace old with new.
    // Here, also handle clearing all documents if both documentsToRemove requests removal of all, and no files are added.
    if (dto.documentsToRemove && leave.documents && leave.documents.length === 0 && !files?.length) {
      // All documents have been removed and no new ones to add; save state.
      const savedLeave = await this.leaveRepo.save(leave);
      const updatedLeave = await this.leaveRepo.findOne({
        where: { id: savedLeave.id, tenantId },
        relations: ['leaveType', 'employee', 'approver'],
      });
      return updatedLeave || savedLeave;
    }

    // Handle document uploads (add new ones)
    if (files && files.length > 0) {
      const newDocumentUrls = await this.leaveFileUploadService.uploadLeaveDocuments(
        files,
        leave.id,
      );
      leave.documents = [...(leave.documents || []), ...newDocumentUrls];
    }

    // Save the leave
    const savedLeave = await this.leaveRepo.save(leave);

    // Reload the leave with all relations to get updated leaveType
    const updatedLeave = await this.leaveRepo.findOne({
      where: { id: savedLeave.id, tenantId },
      relations: ['leaveType', 'employee', 'approver'],
    });

    if (!updatedLeave) {
      // Fallback to saved leave if reload fails
      return savedLeave;
    }

    return updatedLeave;
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
    const limit = 25;
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
        status: In([LeaveStatus.PENDING, LeaveStatus.PROCESSING, LeaveStatus.APPROVED, LeaveStatus.REJECTED]),
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
      .andWhere('leave.status IN (:...statuses)', { statuses: [LeaveStatus.PENDING, LeaveStatus.PROCESSING, LeaveStatus.APPROVED, LeaveStatus.REJECTED] })
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
