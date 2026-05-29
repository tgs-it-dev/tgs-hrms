import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  UseGuards,
  NotFoundException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { TenantId } from '../../common/decorators/company.deorator';
import { InviteStatusService } from './invite-status.service';
import { InviteStatusCronService } from './invite-status-cron.service';
import { SetInviteStatusDto } from './dto/set-invite-status.dto';

@ApiTags('Invite Status')
@ApiBearerAuth()
@Controller('invite-status')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, PermissionsGuard)
export class InviteStatusController {
  constructor(
    private readonly inviteStatusService: InviteStatusService,
    private readonly inviteStatusCronService: InviteStatusCronService,
  ) {}

  /**
   * GET /invite-status/employee/:employeeId
   * Retrieve the current invite status for an employee.
   * Automatically expires INVITE_SENT invites older than 24 h.
   */
  @Get('employee/:employeeId')
  @Roles('admin', 'system-admin', 'hr-admin', 'manager')
  @Permissions('manage_employees')
  @ApiOperation({ summary: 'Get invite status for an employee' })
  @ApiParam({ name: 'employeeId', description: 'Employee UUID' })
  @ApiResponse({ status: 200, description: 'Invite status returned' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  async getInviteStatus(
    @TenantId() tenantId: string,
    @Param('employeeId') employeeId: string,
  ) {
    const status = await this.inviteStatusService.getInviteStatus(
      employeeId,
      tenantId,
    );
    if (status === null) {
      throw new NotFoundException(`Employee '${employeeId}' not found`);
    }
    return { employeeId, status };
  }

  /**
   * PATCH /invite-status/employee/:employeeId
   * Manually override the invite status (Admin/HR only).
   * Useful for re-sending invites or marking as declined.
   */
  @Patch('employee/:employeeId')
  @Roles('admin', 'system-admin', 'hr-admin')
  @Permissions('manage_employees')
  @ApiOperation({
    summary: 'Manually set invite status for an employee (Admin/HR only)',
  })
  @ApiParam({ name: 'employeeId', description: 'Employee UUID' })
  @ApiResponse({ status: 200, description: 'Invite status updated' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  async setInviteStatus(
    @TenantId() tenantId: string,
    @Param('employeeId') employeeId: string,
    @Body() dto: SetInviteStatusDto,
  ) {
    const updated = await this.inviteStatusService.setInviteStatus(
      employeeId,
      tenantId,
      dto.status,
    );
    if (!updated) {
      throw new NotFoundException(`Employee '${employeeId}' not found`);
    }
    return { employeeId, status: dto.status, message: 'Invite status updated' };
  }

  /**
   * POST /invite-status/expire/run
   * Manually trigger the expired-invites sweep for the current tenant.
   * Useful for testing or urgent admin operations without waiting for cron.
   */
  @Post('expire/run')
  @HttpCode(HttpStatus.OK)
  @Roles('admin', 'system-admin')
  @Permissions('manage_employees')
  @ApiOperation({
    summary: 'Manually trigger expired-invite sweep (Admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Sweep completed; returns count of expired invites updated',
  })
  async triggerExpiredInvitesSweep(@TenantId() tenantId: string) {
    const expiredCount =
      await this.inviteStatusService.checkAndUpdateExpiredInvites(tenantId);
    return {
      message: 'Expired invites sweep completed',
      expiredCount,
    };
  }
}
