import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AssetRequestService } from './asset-request.service';
import { CreateAssetRequestDto } from './dto/create-asset-request.dto';
import { RejectAssetRequestDto } from './dto/reject-asset-request.dto';
import { AddAssetCommentDto } from '../asset/dto/add-asset-comment.dto';
import { AssetRequestStatus } from '../../common/constants/enums';

@ApiTags('Asset Requests')
@ApiBearerAuth()
@Controller('asset-requests')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class AssetRequestController {
  constructor(private readonly service: AssetRequestService) {}

  @Post()
  @Roles('user', 'employee', 'manager')
  @ApiOperation({ summary: 'Employee requests an asset' })
  @ApiResponse({ status: 201, description: 'Request created' })
  create(@Request() req: any, @Body() dto: CreateAssetRequestDto) {
    return this.service.create(dto, req.user.id, req.user.tenant_id);
  }

  @Get()
  @ApiOperation({ summary: 'Fetch requests (paginated). Regular users see only their own requests, Admin roles see all requests' })
  findAll(
    @Request() req: any,
    @Query('page') page?: string,
  ) {
    const parsedPage = page ? parseInt(page, 10) : 1;
    return this.service.findAll(
      req.user.tenant_id, 
      parsedPage,
      req.user.id,
      req.user.role
    );
  }

  @Get('team')
  @Roles('manager')
  @ApiOperation({ summary: 'Get asset requests from manager\'s team members (Manager only)' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'status', required: false, enum: AssetRequestStatus, description: 'Filter by status (pending, approved, rejected, cancelled)' })
  @ApiResponse({ status: 200, description: 'Returns paginated list of team asset requests' })
  @ApiResponse({ status: 403, description: 'Forbidden - Manager role required or no teams assigned' })
  getTeamAssetRequests(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('status') status?: string,
  ) {
    const parsedPage = page ? parseInt(page, 10) : 1;
    return this.service.getTeamAssetRequests(
      req.user.id,
      req.user.tenant_id,
      parsedPage,
      status ? { status: status as AssetRequestStatus } : undefined,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get request details' })
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.service.findOne(req.user.tenant_id, id);
  }

  @Put(':id/approve')
  @Roles('network-admin' , 'hr-admin', 'admin')
  @ApiOperation({ summary: 'Approve and assign asset' })
  approve(@Request() req: any, @Param('id') id: string) {
    return this.service.approve(id, req.user.id, req.user.tenant_id);
  }

  @Put(':id/reject')
  @Roles('network-admin', 'hr-admin', 'admin')
  @ApiOperation({ summary: 'Reject request' })
  @ApiResponse({ status: 200, description: 'Request rejected successfully' })
  @ApiResponse({ status: 400, description: 'Request already processed' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  reject(@Request() req: any, @Param('id') id: string, @Body() dto: RejectAssetRequestDto) {
    return this.service.reject(id, req.user.id, req.user.tenant_id, dto.rejection_reason);
  }

  @Delete(':id')
  @Roles('user', 'employee', 'manager')
  @ApiOperation({ summary: 'Delete own pending request' })
  @ApiResponse({ status: 200, description: 'Request deleted successfully' })
  remove(@Request() req: any, @Param('id') id: string) {
    return this.service.remove(id, req.user.id, req.user.tenant_id);
  }

  @Post(':id/comments')
  @Roles('manager', 'hr-admin', 'admin', 'system-admin', 'network-admin')
  @ApiOperation({ summary: 'Add a comment to an asset request. Managers can only comment on requests from their team members' })
  @ApiResponse({ status: 201, description: 'Comment added successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Manager can only comment on requests from their team members' })
  @ApiResponse({ status: 404, description: 'Asset request not found' })
  addComment(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: AddAssetCommentDto,
  ) {
    return this.service.addComment(
      id,
      req.user.id,
      req.user.tenant_id,
      req.user.role,
      dto.comment,
    );
  }

  @Get(':id/comments')
  @ApiOperation({ summary: 'Get all comments for an asset request' })
  @ApiResponse({ status: 200, description: 'List of comments' })
  @ApiResponse({ status: 404, description: 'Asset request not found' })
  getComments(@Request() req: any, @Param('id') id: string) {
    return this.service.getComments(id, req.user.tenant_id);
  }
}


