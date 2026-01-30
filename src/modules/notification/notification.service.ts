import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Notification } from '../../entities/notification.entity';
import { User } from '../../entities/user.entity';
import { NotificationType, NotificationStatus } from '../../common/constants/enums';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /**
   * Create a new notification (saved in DB for record; use gateway for real-time in calling code).
   */
  async create(
    userId: string,
    tenantId: string,
    message: string,
    type: NotificationType,
    options?: { relatedEntityType?: string; relatedEntityId?: string },
  ): Promise<Notification> {
    const notification = this.notificationRepo.create({
      user_id: userId,
      tenant_id: tenantId,
      message,
      type,
      status: NotificationStatus.UNREAD,
      related_entity_type: options?.relatedEntityType ?? null,
      related_entity_id: options?.relatedEntityId ?? null,
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
   * Get relevant user IDs based on role for notification filtering.
   * Professional approach: Each user sees ONLY notifications addressed to them (user_id = recipient).
   * Notifications are created with a specific recipient; no role sees others' notifications.
   */
  private async getRelevantUserIds(
    userId: string,
    _tenantId: string,
    _userRole: string,
  ): Promise<string[]> {
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
   * Build redirect path from notification type (dashboard routes, no entity ID).
   * Manager: leave pending → /dashboard/leaves; attendance → /dashboard/AttendanceTable; task → /dashboard/manager-tasks.
   * Admin/HR: leave approval → /dashboard/leaves.
   */
  buildRedirectPath(notificationType: NotificationType): string | null {
    switch (notificationType) {
      case NotificationType.LEAVE:
        return '/dashboard/leaves';
      case NotificationType.ATTENDANCE:
        return '/dashboard/AttendanceTable';
      case NotificationType.TASK:
        return '/dashboard/manager-tasks';
      default:
        return null;
    }
  }

  /**
   * Mark notification as read and return notification with redirect path for click-to-redirect.
   */
  async markAsReadAndGetRedirect(
    notificationId: string,
    userId: string,
    tenantId: string,
    userRole: string,
  ): Promise<{ notification: Notification; redirect_path: string | null }> {
    const notification = await this.markAsRead(notificationId, userId, tenantId, userRole);
    const redirect_path = this.buildRedirectPath(notification.type);
    return { notification, redirect_path };
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
    options?: { relatedEntityType?: string; relatedEntityId?: string },
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

    const relatedEntityType = options?.relatedEntityType ?? null;
    const relatedEntityId = options?.relatedEntityId ?? null;

    const notifications = userIds.map((userId) =>
      this.notificationRepo.create({
        user_id: userId,
        tenant_id: tenantId,
        message,
        type,
        status: NotificationStatus.UNREAD,
        related_entity_type: relatedEntityType,
        related_entity_id: relatedEntityId,
      }),
    );

    return await this.notificationRepo.save(notifications);
  }
}
