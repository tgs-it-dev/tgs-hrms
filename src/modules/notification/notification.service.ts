import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Notification } from '../../entities/notification.entity';
import { User } from '../../entities/user.entity';
import { Employee } from '../../entities/employee.entity';
import { Team } from '../../entities/team.entity';
import { NotificationType, NotificationStatus, UserRole } from '../../common/constants/enums';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(Team)
    private readonly teamRepo: Repository<Team>,
  ) {}

  /**
   * Create a new notification
   */
  async create(
    userId: string,
    tenantId: string,
    message: string,
    type: NotificationType,
  ): Promise<Notification> {
    const notification = this.notificationRepo.create({
      user_id: userId,
      tenant_id: tenantId,
      message,
      type,
      status: NotificationStatus.UNREAD,
    });

    return await this.notificationRepo.save(notification);
  }

  /**
   * Get all notifications for a user based on their role
   */
  async getUserNotifications(
    userId: string,
    tenantId: string,
    userRole: string,
    status?: NotificationStatus,
    type?: NotificationType,
    limit: number = 50,
  ): Promise<Notification[]> {
    // Get user IDs based on role
    const userIds = await this.getRelevantUserIds(userId, tenantId, userRole);
    
    const query = this.notificationRepo
      .createQueryBuilder('notification')
      .where('notification.user_id IN (:...userIds)', { userIds })
      .andWhere('notification.tenant_id = :tenantId', { tenantId })
      .orderBy('notification.created_at', 'DESC')
      .limit(limit);

    if (status) {
      query.andWhere('notification.status = :status', { status });
    }

    if (type) {
      query.andWhere('notification.type = :type', { type });
    }

    return await query.getMany();
  }

  /**
   * Get relevant user IDs based on role for notification filtering
   */
  private async getRelevantUserIds(
    userId: string,
    tenantId: string,
    userRole: string,
  ): Promise<string[]> {
    // Employee: Only their own notifications
    if (userRole === UserRole.EMPLOYEE) {
      return [userId];
    }

    // Manager: Own notifications + team members' notifications
    if (userRole === UserRole.MANAGER) {
      const userIds = [userId]; // Include manager's own notifications
      
      // Get all teams managed by this manager
      const managedTeams = await this.teamRepo.find({
        where: { manager_id: userId },
      });

      if (managedTeams.length > 0) {
        const teamIds = managedTeams.map((team) => team.id);
        
        // Get all team members
        const teamMembers = await this.employeeRepo.find({
          where: { team_id: In(teamIds) },
          relations: ['user'],
        });

        // Add team members' user IDs
        const teamMemberUserIds = teamMembers
          .map((emp) => emp.user_id)
          .filter((id) => id !== userId); // Exclude manager's own ID (already added)
        
        userIds.push(...teamMemberUserIds);
      }

      return [...new Set(userIds)]; // Remove duplicates
    }

    // HR Admin, Admin, System Admin: All notifications in tenant
    if (
      userRole === UserRole.HR_ADMIN ||
      userRole === UserRole.ADMIN ||
      userRole === UserRole.SYSTEM_ADMIN ||
      userRole === UserRole.NETWORK_ADMIN
    ) {
      // Get all users in the tenant
      const allUsers = await this.userRepo.find({
        where: { tenant_id: tenantId },
        select: ['id'],
      });
      return allUsers.map((user) => user.id);
    }

    // Default: Only own notifications
    return [userId];
  }

  /**
   * Get unread count for a user based on their role
   */
  async getUnreadCount(
    userId: string,
    tenantId: string,
    userRole: string,
  ): Promise<number> {
    const userIds = await this.getRelevantUserIds(userId, tenantId, userRole);
    
    return await this.notificationRepo.count({
      where: {
        user_id: In(userIds),
        tenant_id: tenantId,
        status: NotificationStatus.UNREAD,
      },
    });
  }

  /**
   * Mark notification as read
   */
  async markAsRead(
    notificationId: string,
    userId: string,
    tenantId: string,
    userRole: string,
  ): Promise<Notification> {
    // Get relevant user IDs based on role
    const userIds = await this.getRelevantUserIds(userId, tenantId, userRole);
    
    const notification = await this.notificationRepo.findOne({
      where: {
        id: notificationId,
        user_id: In(userIds),
        tenant_id: tenantId,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found or you do not have access to it');
    }

    notification.status = NotificationStatus.READ;
    return await this.notificationRepo.save(notification);
  }

  /**
   * Mark all notifications as read for a user based on their role
   */
  async markAllAsRead(
    userId: string,
    tenantId: string,
    userRole: string,
  ): Promise<void> {
    const userIds = await this.getRelevantUserIds(userId, tenantId, userRole);
    
    await this.notificationRepo.update(
      {
        user_id: In(userIds),
        tenant_id: tenantId,
        status: NotificationStatus.UNREAD,
      },
      {
        status: NotificationStatus.READ,
      },
    );
  }

  /**
   * Send notifications to multiple users
   */
  async sendToUsers(
    userIds: string[],
    tenantId: string,
    message: string,
    type: NotificationType,
  ): Promise<Notification[]> {
    if (!userIds || userIds.length === 0) {
      throw new BadRequestException('At least one user ID is required');
    }

    // Validate that all users exist and belong to the same tenant
    const users = await this.userRepo.find({
      where: userIds.map((id) => ({ id, tenant_id: tenantId })),
    });

    if (users.length !== userIds.length) {
      const foundIds = users.map((u) => u.id);
      const missingIds = userIds.filter((id) => !foundIds.includes(id));
      throw new NotFoundException(
        `Users not found or don't belong to this tenant: ${missingIds.join(', ')}`,
      );
    }

    // Create notifications for all users
    const notifications = userIds.map((userId) =>
      this.notificationRepo.create({
        user_id: userId,
        tenant_id: tenantId,
        message,
        type,
        status: NotificationStatus.UNREAD,
      }),
    );

    return await this.notificationRepo.save(notifications);
  }
}
