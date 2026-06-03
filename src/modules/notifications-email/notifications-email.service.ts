import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailService } from '../../common/utils/email/email.service';
import { NotificationLog } from '../../entities/notification-log.entity';
import { User } from '../../entities/user.entity';
import {
  NotificationEmailType,
  NotificationLogStatus,
  LeaveStatus,
  WfhStatus,
  OvertimeStatus,
  WorkflowRequestType,
} from '../../common/constants/enums';

// ─── Context types ─────────────────────────────────────────────────────────────

export type WorkflowRequestCategory =
  | WorkflowRequestType.LEAVE
  | WorkflowRequestType.WFH
  | WorkflowRequestType.OVERTIME;

/** Unified context used by the centralized workflow event listener. */
export interface WorkflowEmailContext {
  id: string;
  tenantId: string;
  startDate: Date | string;
  endDate: Date | string;
  requestType: WorkflowRequestCategory;
  reason?: string;
  totalDays?: number;
  hours?: number;
  leaveTypeName?: string;
}

/** Context for leave submission email to manager. */
export interface LeaveEmailContext {
  id: string;
  tenantId: string;
  startDate: Date | string;
  endDate: Date | string;
  totalDays: number;
  reason: string;
  leaveTypeName?: string;
}

/** Context for WFH submission email to manager. */
export interface FlexEmailContext {
  id: string;
  tenantId: string;
  startDate: Date | string;
  endDate: Date | string;
  reason: string;
}

/** Context for overtime submission email to manager. */
export interface OvertimeEmailContext {
  id: string;
  tenantId: string;
  startDate: Date | string;
  endDate: Date | string;
  hours: number;
  reason: string;
}

// ─── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class NotificationsEmailService {
  private readonly logger = new Logger(NotificationsEmailService.name);

  constructor(
    @InjectRepository(NotificationLog)
    private readonly logRepo: Repository<NotificationLog>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  // ─── Leave ───────────────────────────────────────────────────────────────

  sendLeaveRequestNotification(
    managerId: string,
    employeeId: string,
    request: LeaveEmailContext,
  ): void {
    this.run(
      NotificationEmailType.LEAVE_REQUEST,
      request.tenantId,
      async () => {
        const [manager, employee] = await this.resolveUsers(
          managerId,
          employeeId,
        );
        if (!manager.email_notifications_enabled) return null;
        await this.emailService.sendEmail(
          manager.email,
          `[${this.orgName()}] New Leave Request from ${employee.first_name} ${employee.last_name}`,
          this.buildLeaveRequestHtml(
            this.orgName(),
            manager,
            employee,
            request,
            this.requestUrl(request.id),
          ),
          undefined,
          managerId,
        );
        return { recipientEmail: manager.email, recipientUserId: managerId };
      },
    );
  }

  sendLeaveStatusUpdate(
    employeeId: string,
    request: LeaveEmailContext | WorkflowEmailContext,
    status: LeaveStatus,
  ): void {
    this.run(
      NotificationEmailType.LEAVE_STATUS_UPDATE,
      request.tenantId,
      async () => {
        const employee = await this.getUser(employeeId);
        await this.emailService.sendEmail(
          employee.email,
          `[${this.orgName()}] Your Leave Request has been ${status}`,
          this.buildLeaveStatusHtml(
            this.orgName(),
            employee,
            request,
            status,
            this.requestUrl(request.id),
          ),
          undefined,
          employeeId,
        );
        return { recipientEmail: employee.email, recipientUserId: employeeId };
      },
    );
  }

  // ─── WFH (flex) ──────────────────────────────────────────────────────────

  sendFlexRequestNotification(
    managerId: string,
    employeeId: string,
    request: FlexEmailContext,
  ): void {
    this.run(NotificationEmailType.FLEX_REQUEST, request.tenantId, async () => {
      const [manager, employee] = await this.resolveUsers(
        managerId,
        employeeId,
      );
      if (!manager.email_notifications_enabled) return null;
      await this.emailService.sendEmail(
        manager.email,
        `[${this.orgName()}] New WFH Request from ${employee.first_name} ${employee.last_name}`,
        this.buildFlexRequestHtml(
          this.orgName(),
          manager,
          employee,
          request,
          this.requestUrl(request.id),
        ),
        undefined,
        managerId,
      );
      return { recipientEmail: manager.email, recipientUserId: managerId };
    });
  }

  sendFlexStatusUpdate(
    employeeId: string,
    request: FlexEmailContext | WorkflowEmailContext,
    status: WfhStatus,
  ): void {
    this.run(
      NotificationEmailType.FLEX_STATUS_UPDATE,
      request.tenantId,
      async () => {
        const employee = await this.getUser(employeeId);
        await this.emailService.sendEmail(
          employee.email,
          `[${this.orgName()}] Your WFH Request has been ${status}`,
          this.buildFlexStatusHtml(
            this.orgName(),
            employee,
            request,
            status,
            this.requestUrl(request.id),
          ),
          undefined,
          employeeId,
        );
        return { recipientEmail: employee.email, recipientUserId: employeeId };
      },
    );
  }

  // ─── Overtime ─────────────────────────────────────────────────────────────

  sendOvertimeRequestNotification(
    managerId: string,
    employeeId: string,
    request: OvertimeEmailContext,
  ): void {
    this.run(
      NotificationEmailType.OVERTIME_REQUEST,
      request.tenantId,
      async () => {
        const [manager, employee] = await this.resolveUsers(
          managerId,
          employeeId,
        );
        if (!manager.email_notifications_enabled) return null;
        await this.emailService.sendEmail(
          manager.email,
          `[${this.orgName()}] New Overtime Request from ${employee.first_name} ${employee.last_name}`,
          this.buildOvertimeRequestHtml(
            this.orgName(),
            manager,
            employee,
            request,
            this.requestUrl(request.id),
          ),
          undefined,
          managerId,
        );
        return { recipientEmail: manager.email, recipientUserId: managerId };
      },
    );
  }

  sendOvertimeStatusUpdate(
    employeeId: string,
    request: OvertimeEmailContext | WorkflowEmailContext,
    status: OvertimeStatus,
  ): void {
    this.run(
      NotificationEmailType.OVERTIME_STATUS_UPDATE,
      request.tenantId,
      async () => {
        const employee = await this.getUser(employeeId);
        await this.emailService.sendEmail(
          employee.email,
          `[${this.orgName()}] Your Overtime Request has been ${status}`,
          this.buildOvertimeStatusHtml(
            this.orgName(),
            employee,
            request,
            status,
            this.requestUrl(request.id),
          ),
          undefined,
          employeeId,
        );
        return { recipientEmail: employee.email, recipientUserId: employeeId };
      },
    );
  }

  // ─── Generic workflow-step emails ─────────────────────────────────────────

  sendStepApprovedToEmployee(
    employeeId: string,
    context: WorkflowEmailContext,
  ): void {
    this.run(
      NotificationEmailType.WORKFLOW_STEP_PROCESSING,
      context.tenantId,
      async () => {
        const employee = await this.getUser(employeeId);
        await this.emailService.sendEmail(
          employee.email,
          `[${this.orgName()}] Your ${this.labelFor(context.requestType)} Request is Being Processed`,
          this.buildStepApprovedEmployeeHtml(
            this.orgName(),
            employee,
            context,
            this.requestUrl(context.id),
          ),
          undefined,
          employeeId,
        );
        return { recipientEmail: employee.email, recipientUserId: employeeId };
      },
    );
  }

  /**
   * Approver and employee are pre-fetched by the listener (eliminates N+1).
   * Approvers are already filtered by email_notifications_enabled via getUsersByRole.
   */
  sendPendingApprovalToApprover(
    approver: User,
    employee: User,
    context: WorkflowEmailContext,
    stepLabel: string,
  ): void {
    this.run(
      NotificationEmailType.WORKFLOW_PENDING_APPROVAL,
      context.tenantId,
      async () => {
        await this.emailService.sendEmail(
          approver.email,
          `[${this.orgName()}] ${stepLabel} Required — ${employee.first_name} ${employee.last_name}'s ${this.labelFor(context.requestType)} Request`,
          this.buildPendingApprovalHtml(
            this.orgName(),
            approver,
            employee,
            context,
            stepLabel,
            this.requestUrl(context.id),
          ),
          undefined,
          approver.id,
        );
        return { recipientEmail: approver.email, recipientUserId: approver.id };
      },
    );
  }

  // ─── Execution framework ──────────────────────────────────────────────────

  private run(
    type: NotificationEmailType,
    tenantId: string,
    fn: () => Promise<{
      recipientEmail: string;
      recipientUserId: string;
    } | null>,
  ): void {
    Promise.resolve()
      .then(fn)
      .then((result) => {
        if (!result) return; // null = deliberately skipped (opt-out, etc.)
        return this.saveLog({
          type,
          status: NotificationLogStatus.SENT,
          tenant_id: tenantId,
          recipient_email: result.recipientEmail,
          recipient_user_id: result.recipientUserId,
        });
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Notification email failed type=${type}: ${msg}`);
        this.saveLog({
          type,
          status: NotificationLogStatus.FAILED,
          tenant_id: tenantId,
          recipient_email: '',
          recipient_user_id: null,
          error_message: msg,
        }).catch(() => {});
      });
  }

  // ─── DB helpers ───────────────────────────────────────────────────────────

  async getUser(userId: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new Error(`User not found: ${userId}`);
    return user;
  }

  private async resolveUsers(idA: string, idB: string): Promise<[User, User]> {
    const [a, b] = await Promise.all([this.getUser(idA), this.getUser(idB)]);
    return [a, b];
  }

  async saveLog(data: Partial<NotificationLog>): Promise<void> {
    await this.logRepo.save(this.logRepo.create(data));
  }

  // ─── Config helpers ───────────────────────────────────────────────────────

  private orgName(): string {
    return this.configService.get<string>('COMPANY_NAME', 'Your Organisation');
  }

  private requestUrl(requestId: string): string {
    return `${this.configService.get<string>('FRONTEND_URL', '')}/app/requests/${requestId}`;
  }

  private unsubscribeUrl(): string {
    return this.configService.get<string>('UNSUBSCRIBE_URL', '#unsubscribe');
  }

  private labelFor(type: WorkflowRequestCategory): string {
    const labels: Record<WorkflowRequestCategory, string> = {
      [WorkflowRequestType.LEAVE]: 'Leave',
      [WorkflowRequestType.WFH]: 'WFH',
      [WorkflowRequestType.OVERTIME]: 'Overtime',
    };
    return labels[type];
  }

  // ─── HTML templates ───────────────────────────────────────────────────────

  private buildLeaveRequestHtml(
    orgName: string,
    manager: User,
    employee: User,
    request: LeaveEmailContext | WorkflowEmailContext,
    url: string,
  ): string {
    const totalDays = (request as LeaveEmailContext).totalDays;
    const leaveTypeName =
      (request as LeaveEmailContext).leaveTypeName ?? 'Leave';
    return this.wrapLayout(
      orgName,
      `
      <h2 style="color:#1a1a2e;margin:0 0 16px">New Leave Request</h2>
      <p>Hi ${this.esc(manager.first_name)},</p>
      <p><strong>${this.esc(employee.first_name)} ${this.esc(employee.last_name)}</strong> has submitted a leave request that requires your attention.</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0">
        <tr><td style="${this.tdL()}">Type</td><td style="${this.tdV()}">${this.esc(leaveTypeName)}</td></tr>
        <tr><td style="${this.tdL()}">From</td><td style="${this.tdV()}">${this.fmtDate(request.startDate)}</td></tr>
        <tr><td style="${this.tdL()}">To</td><td style="${this.tdV()}">${this.fmtDate(request.endDate)}</td></tr>
        ${totalDays != null ? `<tr><td style="${this.tdL()}">Days</td><td style="${this.tdV()}">${totalDays}</td></tr>` : ''}
        ${request.reason ? `<tr><td style="${this.tdL()}">Reason</td><td style="${this.tdV()}">${this.esc(request.reason)}</td></tr>` : ''}
      </table>
      ${this.btn(url, 'Review Request')}
    `,
    );
  }

  private buildLeaveStatusHtml(
    orgName: string,
    employee: User,
    request: LeaveEmailContext | WorkflowEmailContext,
    status: LeaveStatus,
    url: string,
  ): string {
    const approved = status === LeaveStatus.APPROVED;
    const totalDays = (request as LeaveEmailContext).totalDays;
    const leaveTypeName =
      (request as LeaveEmailContext).leaveTypeName ?? 'Leave';
    const label = status.charAt(0).toUpperCase() + status.slice(1);
    return this.wrapLayout(
      orgName,
      `
      <h2 style="color:#1a1a2e;margin:0 0 16px">Leave Request ${label}</h2>
      <p>Hi ${this.esc(employee.first_name)},</p>
      <p>Your leave request has been <strong style="color:${approved ? '#22c55e' : '#ef4444'}">${label}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0">
        <tr><td style="${this.tdL()}">Type</td><td style="${this.tdV()}">${this.esc(leaveTypeName)}</td></tr>
        <tr><td style="${this.tdL()}">From</td><td style="${this.tdV()}">${this.fmtDate(request.startDate)}</td></tr>
        <tr><td style="${this.tdL()}">To</td><td style="${this.tdV()}">${this.fmtDate(request.endDate)}</td></tr>
        ${totalDays != null ? `<tr><td style="${this.tdL()}">Days</td><td style="${this.tdV()}">${totalDays}</td></tr>` : ''}
      </table>
      ${this.btn(url, 'View Request')}
    `,
    );
  }

  private buildFlexRequestHtml(
    orgName: string,
    manager: User,
    employee: User,
    request: FlexEmailContext | WorkflowEmailContext,
    url: string,
  ): string {
    return this.wrapLayout(
      orgName,
      `
      <h2 style="color:#1a1a2e;margin:0 0 16px">New WFH Request</h2>
      <p>Hi ${this.esc(manager.first_name)},</p>
      <p><strong>${this.esc(employee.first_name)} ${this.esc(employee.last_name)}</strong> has submitted a Work-From-Home request that requires your attention.</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0">
        <tr><td style="${this.tdL()}">From</td><td style="${this.tdV()}">${this.fmtDate(request.startDate)}</td></tr>
        <tr><td style="${this.tdL()}">To</td><td style="${this.tdV()}">${this.fmtDate(request.endDate)}</td></tr>
        ${request.reason ? `<tr><td style="${this.tdL()}">Reason</td><td style="${this.tdV()}">${this.esc(request.reason)}</td></tr>` : ''}
      </table>
      ${this.btn(url, 'Review Request')}
    `,
    );
  }

  private buildFlexStatusHtml(
    orgName: string,
    employee: User,
    request: FlexEmailContext | WorkflowEmailContext,
    status: WfhStatus,
    url: string,
  ): string {
    const approved = status === WfhStatus.APPROVED;
    const label = status.charAt(0).toUpperCase() + status.slice(1);
    return this.wrapLayout(
      orgName,
      `
      <h2 style="color:#1a1a2e;margin:0 0 16px">WFH Request ${label}</h2>
      <p>Hi ${this.esc(employee.first_name)},</p>
      <p>Your Work-From-Home request has been <strong style="color:${approved ? '#22c55e' : '#ef4444'}">${label}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0">
        <tr><td style="${this.tdL()}">From</td><td style="${this.tdV()}">${this.fmtDate(request.startDate)}</td></tr>
        <tr><td style="${this.tdL()}">To</td><td style="${this.tdV()}">${this.fmtDate(request.endDate)}</td></tr>
      </table>
      ${this.btn(url, 'View Request')}
    `,
    );
  }

  private buildOvertimeRequestHtml(
    orgName: string,
    manager: User,
    employee: User,
    request: OvertimeEmailContext | WorkflowEmailContext,
    url: string,
  ): string {
    const hours = (request as OvertimeEmailContext).hours;
    return this.wrapLayout(
      orgName,
      `
      <h2 style="color:#1a1a2e;margin:0 0 16px">New Overtime Request</h2>
      <p>Hi ${this.esc(manager.first_name)},</p>
      <p><strong>${this.esc(employee.first_name)} ${this.esc(employee.last_name)}</strong> has submitted an overtime request that requires your attention.</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0">
        <tr><td style="${this.tdL()}">From</td><td style="${this.tdV()}">${this.fmtDate(request.startDate)}</td></tr>
        <tr><td style="${this.tdL()}">To</td><td style="${this.tdV()}">${this.fmtDate(request.endDate)}</td></tr>
        ${hours != null ? `<tr><td style="${this.tdL()}">Hours</td><td style="${this.tdV()}">${hours}h</td></tr>` : ''}
        ${request.reason ? `<tr><td style="${this.tdL()}">Reason</td><td style="${this.tdV()}">${this.esc(request.reason)}</td></tr>` : ''}
      </table>
      ${this.btn(url, 'Review Request')}
    `,
    );
  }

  private buildOvertimeStatusHtml(
    orgName: string,
    employee: User,
    request: OvertimeEmailContext | WorkflowEmailContext,
    status: OvertimeStatus,
    url: string,
  ): string {
    const approved = status === OvertimeStatus.APPROVED;
    const label = status.charAt(0).toUpperCase() + status.slice(1);
    const hours = (request as OvertimeEmailContext).hours;
    return this.wrapLayout(
      orgName,
      `
      <h2 style="color:#1a1a2e;margin:0 0 16px">Overtime Request ${label}</h2>
      <p>Hi ${this.esc(employee.first_name)},</p>
      <p>Your overtime request has been <strong style="color:${approved ? '#22c55e' : '#ef4444'}">${label}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0">
        <tr><td style="${this.tdL()}">From</td><td style="${this.tdV()}">${this.fmtDate(request.startDate)}</td></tr>
        <tr><td style="${this.tdL()}">To</td><td style="${this.tdV()}">${this.fmtDate(request.endDate)}</td></tr>
        ${hours != null ? `<tr><td style="${this.tdL()}">Hours</td><td style="${this.tdV()}">${hours}h</td></tr>` : ''}
      </table>
      ${this.btn(url, 'View Request')}
    `,
    );
  }

  private buildStepApprovedEmployeeHtml(
    orgName: string,
    employee: User,
    ctx: WorkflowEmailContext,
    url: string,
  ): string {
    const typeLabel = this.labelFor(ctx.requestType);
    return this.wrapLayout(
      orgName,
      `
      <h2 style="color:#1a1a2e;margin:0 0 16px">${typeLabel} Request in Review</h2>
      <p>Hi ${this.esc(employee.first_name)},</p>
      <p>Your <strong>${typeLabel}</strong> request has been approved at one stage and is now moving to the next reviewer.</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0">
        <tr><td style="${this.tdL()}">From</td><td style="${this.tdV()}">${this.fmtDate(ctx.startDate)}</td></tr>
        <tr><td style="${this.tdL()}">To</td><td style="${this.tdV()}">${this.fmtDate(ctx.endDate)}</td></tr>
        <tr><td style="${this.tdL()}">Status</td><td style="${this.tdV()}"><span style="color:#f59e0b;font-weight:600">In Review</span></td></tr>
      </table>
      <p style="color:#6b7280;font-size:13px">You will receive another email once a final decision is made.</p>
      ${this.btn(url, 'View Request')}
    `,
    );
  }

  private buildPendingApprovalHtml(
    orgName: string,
    approver: User,
    employee: User,
    ctx: WorkflowEmailContext,
    stepLabel: string,
    url: string,
  ): string {
    const typeLabel = this.labelFor(ctx.requestType);
    return this.wrapLayout(
      orgName,
      `
      <h2 style="color:#1a1a2e;margin:0 0 16px">${stepLabel} Required</h2>
      <p>Hi ${this.esc(approver.first_name)},</p>
      <p>A <strong>${typeLabel}</strong> request from <strong>${this.esc(employee.first_name)} ${this.esc(employee.last_name)}</strong> is awaiting your approval.</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0">
        <tr><td style="${this.tdL()}">From</td><td style="${this.tdV()}">${this.fmtDate(ctx.startDate)}</td></tr>
        <tr><td style="${this.tdL()}">To</td><td style="${this.tdV()}">${this.fmtDate(ctx.endDate)}</td></tr>
        ${ctx.hours != null ? `<tr><td style="${this.tdL()}">Hours</td><td style="${this.tdV()}">${ctx.hours}h</td></tr>` : ''}
        ${ctx.totalDays != null ? `<tr><td style="${this.tdL()}">Days</td><td style="${this.tdV()}">${ctx.totalDays}</td></tr>` : ''}
        ${ctx.reason ? `<tr><td style="${this.tdL()}">Reason</td><td style="${this.tdV()}">${this.esc(ctx.reason)}</td></tr>` : ''}
      </table>
      ${this.btn(url, 'Review Request')}
    `,
    );
  }

  // ─── Layout primitives ────────────────────────────────────────────────────

  private wrapLayout(orgName: string, body: string): string {
    return `
<!DOCTYPE html><html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)">
        <tr><td style="background:#1a1a2e;padding:24px 32px">
          <span style="color:#ffffff;font-size:18px;font-weight:700">${this.esc(orgName)}</span>
        </td></tr>
        <tr><td style="padding:32px;color:#374151;font-size:15px;line-height:1.6">${body}</td></tr>
        <tr><td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;text-align:center;color:#9ca3af;font-size:12px">
          <p style="margin:0">&copy; ${new Date().getFullYear()} ${this.esc(orgName)}. All rights reserved.</p>
          <p style="margin:8px 0 0"><a href="${this.unsubscribeUrl()}" style="color:#9ca3af;text-decoration:underline">Unsubscribe</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  }

  private btn(url: string, label: string): string {
    return `<div style="text-align:center;margin:28px 0">
      <a href="${url}" style="display:inline-block;background:#1a1a2e;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:600;font-size:14px">${label}</a>
      <p style="margin:12px 0 0;font-size:12px;color:#6b7280">Or copy: <a href="${url}" style="color:#6b7280">${url}</a></p>
    </div>`;
  }

  private tdL(): string {
    return 'padding:10px 16px 10px 0;font-weight:600;color:#374151;width:120px;vertical-align:top;border-bottom:1px solid #f3f4f6';
  }

  private tdV(): string {
    return 'padding:10px 0;color:#6b7280;vertical-align:top;border-bottom:1px solid #f3f4f6';
  }

  private fmtDate(date: Date | string): string {
    return new Date(date).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  private esc(v: string): string {
    return v
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
