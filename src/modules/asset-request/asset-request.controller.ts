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
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AssetRequestService } from './asset-request.service';
import { CreateAssetRequestDto } from './dto/create-asset-request.dto';

@ApiTags('Asset Requests')
@ApiBearerAuth()
@Controller('asset-requests')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class AssetRequestController {
  constructor(private readonly service: AssetRequestService) {}

  @Post()
  @Roles('user', 'employee')
  @ApiOperation({ summary: 'Employee requests an asset' })
  @ApiResponse({ status: 201, description: 'Request created' })
  create(@Request() req: any, @Body() dto: CreateAssetRequestDto) {
    return this.service.create(dto, req.user.id, req.user.tenant_id);
  }

  @Get()
  @ApiOperation({ summary: 'Fetch requests (filter by requester or tenant, paginated)' })
  findAll(
    @Request() req: any,
    @Query('requestedBy') requestedBy?: string,
    @Query('page') page?: string,
  ) {
    const parsedPage = page ? parseInt(page, 10) : 1;
    return this.service.findAll(req.user.tenant_id, requestedBy, parsedPage);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get request details' })
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.service.findOne(req.user.tenant_id, id);
  }

  @Put(':id/approve')
  @Roles('network-admin')
  @ApiOperation({ summary: 'Approve and assign asset' })
  approve(@Request() req: any, @Param('id') id: string) {
    return this.service.approve(id, req.user.id, req.user.tenant_id);
  }

  @Put(':id/reject')
  @Roles('network-admin')
  @ApiOperation({ summary: 'Reject request' })
  @ApiResponse({ status: 200, description: 'Request rejected successfully' })
  @ApiResponse({ status: 400, description: 'Request already processed' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        remarks: { type: 'string', example: 'Insufficient justification for request', description: 'Reason for rejection' },
      },
      required: ['remarks'],
    },
    description: 'Rejection reason for the asset request',
  })
  reject(@Request() req: any, @Param('id') id: string, @Body('remarks') remarks: string) {
    return this.service.reject(id, req.user.id, req.user.tenant_id, remarks);
  }

  @Delete(':id')
  @Roles('user', 'employee')
  @ApiOperation({ summary: 'Delete own pending request' })
  @ApiResponse({ status: 200, description: 'Request deleted successfully' })
  remove(@Request() req: any, @Param('id') id: string) {
    return this.service.remove(id, req.user.id, req.user.tenant_id);
  }
}


