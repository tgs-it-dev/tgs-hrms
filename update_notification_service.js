const fs = require('fs');
const path = require('path');

const filePath = '/Users/Saad/tgs_projects/tgs-hrms/src/modules/notification/notification.service.ts';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Imports
content = content.replace(
  "import { InjectRepository } from '@nestjs/typeorm';",
  "import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';"
);
content = content.replace(
  "import { Repository } from 'typeorm';",
  "import { DataSource, EntityManager, Repository } from 'typeorm';\nimport { TenantDatabaseService } from '../../common/services/tenant-database.service';"
);

// 2. Constructor and helper
content = content.replace(
  "    private readonly userRepo: Repository<User>,\n  ) {}",
  "    private readonly userRepo: Repository<User>,\n    private readonly tenantDbService: TenantDatabaseService,\n    @InjectDataSource()\n    private readonly dataSource: DataSource,\n  ) {}\n\n  private async isTenantSchemaProvisioned(tenantId: string): Promise<boolean> {\n    const result = await this.dataSource.query<{ schema_provisioned: boolean }[]>(\n      `SELECT schema_provisioned FROM public.tenants WHERE id = $1 LIMIT 1`,\n      [tenantId],\n    );\n    return result[0]?.schema_provisioned ?? false;\n  }"
);

// 3. create method
const createMatch = /async create\([\s\S]*?\): Promise<Notification> \{/;
const doCreateDef = `  async create(
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
`;
content = content.replace(createMatch, doCreateDef);

// 4. getUserNotifications
const getUserMatch = /async getUserNotifications\([\s\S]*?\): Promise<Notification\[\]> \{/;
const doGetUserDef = `  async getUserNotifications(
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
`;
content = content.replace(getUserMatch, doGetUserDef);

// 5. getUnreadCount
const getUnreadMatch = /async getUnreadCount\([\s\S]*?\): Promise<number> \{/;
const doGetUnreadDef = `  async getUnreadCount(
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
`;
content = content.replace(getUnreadMatch, doGetUnreadDef);

// 6. markAsRead
const markAsReadMatch = /async markAsRead\([\s\S]*?\): Promise<Notification> \{/;
const doMarkAsReadDef = `  async markAsRead(
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
`;
content = content.replace(markAsReadMatch, doMarkAsReadDef);

// 7. markAllAsRead
const markAllAsReadMatch = /async markAllAsRead\([\s\S]*?\): Promise<void> \{/;
const doMarkAllAsReadDef = `  async markAllAsRead(
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
`;
content = content.replace(markAllAsReadMatch, doMarkAllAsReadDef);

// 8. markAsReadForRelatedEntity
const markAsReadForRelatedMatch = /async markAsReadForRelatedEntity\([\s\S]*?\): Promise<void> \{/;
const doMarkAsReadForRelatedDef = `  async markAsReadForRelatedEntity(
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
`;
content = content.replace(markAsReadForRelatedMatch, doMarkAsReadForRelatedDef);

// 9. sendToUsers
const sendToUsersMatch = /async sendToUsers\([\s\S]*?\): Promise<Notification\[\]> \{/;
const doSendToUsersDef = `  async sendToUsers(
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
`;
content = content.replace(sendToUsersMatch, doSendToUsersDef);

// Replace usages inside methods
let newContent = content.replace(/this\.notificationRepo/g, 'notificationRepo');

// Fix the constructor replacements back:
newContent = newContent.replace(
  "private readonly notificationRepo: Repository<Notification>,",
  "private readonly notificationRepo: Repository<Notification>,"
);
// Fix the internal variables
newContent = newContent.replace(/const notificationRepo = em \? em\.getRepository\(Notification\) : notificationRepo;/g, 'const notificationRepo = em ? em.getRepository(Notification) : this.notificationRepo;');


fs.writeFileSync(filePath, newContent, 'utf8');
console.log('NotificationService updated successfully');
