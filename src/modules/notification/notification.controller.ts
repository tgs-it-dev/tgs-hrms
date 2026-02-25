import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { NotificationStatus, NotificationType } from '../../common/constants/enums';
import { SendNotificationDto } from './dto/send-notification.dto';
import { AuthenticatedRequest } from '../../common/types/request.types';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'Get logged-in user notifications' })
  @ApiResponse({
    status: 200,
    description: 'List of notifications retrieved successfully',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: NotificationStatus,
    description: 'Filter by notification status',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: NotificationType,
    description: 'Filter by notification type',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of notifications to return (default: 50)',
  })
  async getNotifications(
    @Request() req: AuthenticatedRequest,
    @Query('status') status?: NotificationStatus,
    @Query('type') type?: NotificationType,
    @Query('limit') limit?: number,
  ) {
    const userRole = req.user.role || 'employee';
    const notifications = await this.notificationService.getUserNotifications(
      req.user.id,
      req.user.tenant_id,
      userRole,
      status,
      type,
      limit ? parseInt(limit.toString()) : 50,
    );

    const unreadCount = await this.notificationService.getUnreadCount(
      req.user.id,
      req.user.tenant_id,
      userRole,
    );

    const notificationsWithRedirect = notifications.map((n) => ({
      ...n,
      redirect_path: this.notificationService.buildRedirectPath(n.type),
    }));

    return {
      notifications: notificationsWithRedirect,
      unreadCount,
    };
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiParam({
    name: 'id',
    description: 'Notification ID',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Notification marked as read successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Notification not found',
  })
  async markAsRead(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const userRole = req.user.role || 'employee';
    return this.notificationService.markAsRead(
      id,
      req.user.id,
      req.user.tenant_id,
      userRole,
    );
  }

  @Patch(':id/read-and-redirect')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark notification as read and get redirect path',
    description:
      'Marks the notification as read and returns redirect_path: leave → /dashboard/leaves, attendance → /dashboard/AttendanceTable, task → /dashboard/manager-tasks.',
  })
  @ApiParam({
    name: 'id',
    description: 'Notification ID',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Notification marked as read; redirect_path returned for click-to-redirect',
  })
  @ApiResponse({
    status: 404,
    description: 'Notification not found',
  })
  async markAsReadAndRedirect(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const userRole = req.user.role || 'employee';
    return this.notificationService.markAsReadAndGetRedirect(
      id,
      req.user.id,
      req.user.tenant_id,
      userRole,
    );
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({
    status: 200,
    description: 'All notifications marked as read successfully',
  })
  async markAllAsRead(@Request() req: AuthenticatedRequest) {
    const userRole = req.user.role || 'employee';
    await this.notificationService.markAllAsRead(
      req.user.id,
      req.user.tenant_id,
      userRole,
    );
    return { message: 'All notifications marked as read' };
  }

 
}
