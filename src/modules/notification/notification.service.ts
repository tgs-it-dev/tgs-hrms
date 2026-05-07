import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { TenantDatabaseService } from '../../common/services/tenant-database.service';
import { Notification } from '../../entities/notification.entity';
import { User } from '../../entities/user.entity';
import {
  NotificationType,
  NotificationStatus,
  NotificationAction,
} from '../../common/constants/enums';

export interface CreateNotificationOptions {
  relatedEntityType?: string;
  relatedEntityId?: string;
  senderId?: string;
  senderRole?: string;
  action?: NotificationAction;
  isSystem?: boolean;
}

/** Minimal leave shape for workflow helpers (avoids circular deps). */
export interface LeaveNotificationPayload {
  id: string;
  tenantId: string;
}

/** Minimal employee shape for dynamic messages. */
export interface EmployeeNotificationPayload {
  id: string;
  first_name: string;
  last_name: string;
}

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly tenantDbService: TenantDatabaseService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  private async isTenantSchemaProvisioned(tenantId: string): Promise<boolean> {
    const result = await this.dataSource.query<{ schema_provisioned: boolean }[]>(
      `SELECT schema_provisioned FROM public.tenants WHERE id = $1 LIMIT 1`,
      [tenantId],
    );
    return result[0]?.schema_provisioned ?? false;
  }

  /**
   * Create a new notification (saved in DB for record; use gateway for real-time in calling code).
   * Validates that recipient belongs to tenant when possible; one row per recipient.
   */
    async create(
    userId: string,
    tenantId: string,
    message: string,
    type: NotificationType,
    options?: CreateNotificationOptions,
  ): Promise<Notification> {
    const isProvisioned = await this.isTenantSchemaProvisioned(tenantId);
    if (isProvisioned) {
      return this.tenantDbService.withTenantSchema(tenantId, (em) => this.doCreate(em, userId, tenantId, message, type, options));
    }
    return this.doCreate(null, userId, tenantId, message, type, options);
  }

  private async doCreate(
    em: EntityManager | null,
    userId: string,
    tenantId: string,
    message: string,
    type: NotificationType,
    options?: CreateNotificationOptions,
  ): Promise<Notification> {
    const notificationRepo = em ? em.getRepository(Notification) : this.notificationRepo;

    const notification = notificationRepo.create({
      user_id: userId,
      tenant_id: tenantId,
      message,
      type,
      status: NotificationStatus.UNREAD,
      related_entity_type: options?.relatedEntityType ?? null,
      related_entity_id: options?.relatedEntityId ?? null,
      sender_id: options?.senderId ?? null,
      sender_role: options?.senderRole ?? null,
      action: options?.action ?? null,
      is_system: options?.isSystem ?? false,
    });

    return await notificationRepo.save(notification);
  }

  /**
   * Get all notifications for the requesting user only.
   * Rule: each user sees ONLY notifications where user_id = their id (actor never sees their own action's notification as creator; recipient is single).
   */
    async getUserNotifications(
    userId: string,
    tenantId: string,
    _userRole: string,
    status?: NotificationStatus,
    type?: NotificationType,
    limit: number = 50,
  ): Promise<Notification[]> {
    const isProvisioned = await this.isTenantSchemaProvisioned(tenantId);
    if (isProvisioned) {
      return this.tenantDbService.withTenantSchemaReadOnly(tenantId, (em) => this.doGetUserNotifications(em, userId, tenantId, _userRole, status, type, limit));
    }
    return this.doGetUserNotifications(null, userId, tenantId, _userRole, status, type, limit);
  }

  private async doGetUserNotifications(
    em: EntityManager | null,
    userId: string,
    tenantId: string,
    _userRole: string,
    status?: NotificationStatus,
    type?: NotificationType,
    limit: number = 50,
  ): Promise<Notification[]> {
    const notificationRepo = em ? em.getRepository(Notification) : this.notificationRepo;

    const query = notificationRepo
      .createQueryBuilder('notification')
      .where('notification.user_id = :userId', { userId })
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
   * Get unread count for the requesting user only (user_id = userId).
   */
    async getUnreadCount(
    userId: string,
    tenantId: string,
    _userRole: string,
  ): Promise<number> {
    const isProvisioned = await this.isTenantSchemaProvisioned(tenantId);
    if (isProvisioned) {
      return this.tenantDbService.withTenantSchemaReadOnly(tenantId, (em) => this.doGetUnreadCount(em, userId, tenantId, _userRole));
    }
    return this.doGetUnreadCount(null, userId, tenantId, _userRole);
  }

  private async doGetUnreadCount(
    em: EntityManager | null,
    userId: string,
    tenantId: string,
    _userRole: string,
  ): Promise<number> {
    const notificationRepo = em ? em.getRepository(Notification) : this.notificationRepo;

    return await notificationRepo.count({
      where: {
        user_id: userId,
        tenant_id: tenantId,
        status: NotificationStatus.UNREAD,
      },
    });
  }

  /**
   * Mark notification as read — only if it belongs to the requesting user (user_id = userId).
   */
    async markAsRead(
    notificationId: string,
    userId: string,
    tenantId: string,
    _userRole: string,
  ): Promise<Notification> {
    const isProvisioned = await this.isTenantSchemaProvisioned(tenantId);
    if (isProvisioned) {
      return this.tenantDbService.withTenantSchema(tenantId, (em) => this.doMarkAsRead(em, notificationId, userId, tenantId, _userRole));
    }
    return this.doMarkAsRead(null, notificationId, userId, tenantId, _userRole);
  }

  private async doMarkAsRead(
    em: EntityManager | null,
    notificationId: string,
    userId: string,
    tenantId: string,
    _userRole: string,
  ): Promise<Notification> {
    const notificationRepo = em ? em.getRepository(Notification) : this.notificationRepo;

    const notification = await notificationRepo.findOne({
      where: {
        id: notificationId,
        user_id: userId,
        tenant_id: tenantId,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found or you do not have access to it');
    }

    notification.status = NotificationStatus.READ;
    return await notificationRepo.save(notification);
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
   * Mark all notifications as read for the requesting user only (user_id = userId).
   */
    async markAllAsRead(
    userId: string,
    tenantId: string,
    _userRole: string,
  ): Promise<void> {
    const isProvisioned = await this.isTenantSchemaProvisioned(tenantId);
    if (isProvisioned) {
      return this.tenantDbService.withTenantSchema(tenantId, (em) => this.doMarkAllAsRead(em, userId, tenantId, _userRole));
    }
    return this.doMarkAllAsRead(null, userId, tenantId, _userRole);
  }

  private async doMarkAllAsRead(
    em: EntityManager | null,
    userId: string,
    tenantId: string,
    _userRole: string,
  ): Promise<void> {
    const notificationRepo = em ? em.getRepository(Notification) : this.notificationRepo;

    await notificationRepo.update(
      {
        user_id: userId,
        tenant_id: tenantId,
        status: NotificationStatus.UNREAD,
      },
      {
        status: NotificationStatus.READ,
      },
    );
  }

  /**
   * Mark all notifications for a user that are related to a specific entity (e.g. a leave) as read.
   * Used e.g. when manager processes leave so their "leave applied" notification is cleared from inbox.
   */
    async markAsReadForRelatedEntity(
    userId: string,
    tenantId: string,
    relatedEntityType: string,
    relatedEntityId: string,
  ): Promise<void> {
    const isProvisioned = await this.isTenantSchemaProvisioned(tenantId);
    if (isProvisioned) {
      return this.tenantDbService.withTenantSchema(tenantId, (em) => this.doMarkAsReadForRelatedEntity(em, userId, tenantId, relatedEntityType, relatedEntityId));
    }
    return this.doMarkAsReadForRelatedEntity(null, userId, tenantId, relatedEntityType, relatedEntityId);
  }

  private async doMarkAsReadForRelatedEntity(
    em: EntityManager | null,
    userId: string,
    tenantId: string,
    relatedEntityType: string,
    relatedEntityId: string,
  ): Promise<void> {
    const notificationRepo = em ? em.getRepository(Notification) : this.notificationRepo;

    await notificationRepo.update(
      {
        user_id: userId,
        tenant_id: tenantId,
        related_entity_type: relatedEntityType,
        related_entity_id: relatedEntityId,
        status: NotificationStatus.UNREAD,
      },
      {
        status: NotificationStatus.READ,
      },
    );
  }

  /**
   * Send notifications to multiple users. One notification row per recipient; tenant-safe.
   */
    async sendToUsers(
    userIds: string[],
    tenantId: string,
    message: string,
    type: NotificationType,
    options?: CreateNotificationOptions,
  ): Promise<Notification[]> {
    const isProvisioned = await this.isTenantSchemaProvisioned(tenantId);
    if (isProvisioned) {
      return this.tenantDbService.withTenantSchema(tenantId, (em) => this.doSendToUsers(em, userIds, tenantId, message, type, options));
    }
    return this.doSendToUsers(null, userIds, tenantId, message, type, options);
  }

  private async doSendToUsers(
    em: EntityManager | null,
    userIds: string[],
    tenantId: string,
    message: string,
    type: NotificationType,
    options?: CreateNotificationOptions,
  ): Promise<Notification[]> {
    const notificationRepo = em ? em.getRepository(Notification) : this.notificationRepo;

    if (!userIds || userIds.length === 0) {
      throw new BadRequestException('At least one user ID is required');
    }

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

    const notifications = userIds.map((userId) =>
      notificationRepo.create({
        user_id: userId,
        tenant_id: tenantId,
        message,
        type,
        status: NotificationStatus.UNREAD,
        related_entity_type: options?.relatedEntityType ?? null,
        related_entity_id: options?.relatedEntityId ?? null,
        sender_id: options?.senderId ?? null,
        sender_role: options?.senderRole ?? null,
        action: options?.action ?? null,
        is_system: options?.isSystem ?? false,
      }),
    );

    return await notificationRepo.save(notifications);
  }

  // ---------- Leave workflow helpers ----------

  /**
   * When employee applies for leave: notify manager(s).
   */
  async notifyLeaveApplied(
    leave: LeaveNotificationPayload,
    employee: EmployeeNotificationPayload,
    managerUserIds: string[],
  ): Promise<Notification[]> {
    if (managerUserIds.length === 0) return [];
    const name = [employee.first_name, employee.last_name].filter(Boolean).join(' ').trim() || 'An employee';
    const message = `Leave request from ${name} is pending your approval`;
    return this.sendToUsers(managerUserIds, leave.tenantId, message, NotificationType.LEAVE, {
      relatedEntityType: 'leave',
      relatedEntityId: leave.id,
      senderId: employee.id,
      senderRole: 'employee',
      action: NotificationAction.APPLIED,
      isSystem: false,
    });
  }

  /**
   * When manager processes leave (marks as PROCESSING): notify employee and admin(s).
   */
  async notifyLeaveProcessing(
    leave: LeaveNotificationPayload,
    managerUserId: string,
    employee: EmployeeNotificationPayload,
    adminUserIds: string[],
  ): Promise<{ employeeNotification: Notification; adminNotifications: Notification[] }> {
    const empMessage = 'Your leave has been approved by your manager and is now in processing';
    const employeeNotification = await this.create(
      employee.id,
      leave.tenantId,
      empMessage,
      NotificationType.LEAVE,
      {
        relatedEntityType: 'leave',
        relatedEntityId: leave.id,
        senderId: managerUserId,
        senderRole: 'manager',
        action: NotificationAction.PROCESSING,
        isSystem: false,
      },
    );

    const name = [employee.first_name, employee.last_name].filter(Boolean).join(' ').trim() || 'An employee';
    const adminMessage = `${name}'s leave has been submitted by manager and is awaiting your approval`;
    const adminUserIdsFiltered = adminUserIds.filter((id) => id !== managerUserId);
    const adminNotifications =
      adminUserIdsFiltered.length === 0
        ? []
        : await this.sendToUsers(adminUserIdsFiltered, leave.tenantId, adminMessage, NotificationType.LEAVE, {
            relatedEntityType: 'leave',
            relatedEntityId: leave.id,
            senderId: managerUserId,
            senderRole: 'manager',
            action: NotificationAction.PROCESSING,
            isSystem: false,
          });

    return { employeeNotification, adminNotifications };
  }

  /**
   * When admin approves or rejects leave: notify employee only.
   */
  async notifyLeaveFinalDecision(
    leave: LeaveNotificationPayload,
    adminUserId: string,
    _employee: EmployeeNotificationPayload,
    approved: boolean,
  ): Promise<Notification> {
    const message = approved
      ? 'Your leave request has been approved'
      : 'Your leave request was rejected';
    return this.create(
      _employee.id,
      leave.tenantId,
      message,
      NotificationType.LEAVE,
      {
        relatedEntityType: 'leave',
        relatedEntityId: leave.id,
        senderId: adminUserId,
        senderRole: 'admin',
        action: approved ? NotificationAction.APPROVED : NotificationAction.REJECTED,
        isSystem: false,
      },
    );
  }
}
