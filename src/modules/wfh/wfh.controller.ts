import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Request,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';

import { WfhService } from './wfh.service';
import { CreateWfhDto } from './dto/create-wfh.dto';
import { WfhStatus } from '../../common/constants/enums';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('WFH')
@ApiBearerAuth()
@Controller('wfh')
export class WfhController {
  constructor(private readonly wfhService: WfhService) {}

  @Post()
  @ApiOperation({ summary: 'Submit a WFH request' })
  async create(@Body() dto: CreateWfhDto, @Request() req: any) {
    return this.wfhService.createWfhRequest(req.user.id, req.user.tenant_id, dto);
  }

  @Get()
  @ApiOperation({ summary: "Get current user's WFH requests" })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async findMine(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.wfhService.getMyWfhRequests(
      req.user.id,
      req.user.tenant_id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get('all')
  @UseGuards(RolesGuard)
  @Roles('admin', 'hr-admin', 'system-admin', 'network-admin', 'manager')
  @ApiOperation({ summary: 'Get all WFH requests (admin/manager view)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', enum: WfhStatus, required: false })
  async findAll(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: WfhStatus,
  ) {
    return this.wfhService.getAllWfhRequests(
      req.user.tenant_id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      status,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single WFH request by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.wfhService.getWfhById(id, req.user.tenant_id);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a pending WFH request' })
  async cancel(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.wfhService.cancelWfhRequest(id, req.user.id, req.user.tenant_id);
  }
}
