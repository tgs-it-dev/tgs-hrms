import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBody
} from '@nestjs/swagger';
import { LeaveService } from './leave.service';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { UpdateLeaveDto } from './dto/update-leave.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';


@ApiTags('Leaves')
@Controller('leaves')
@UseGuards(JwtAuthGuard)
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  @Post()
   @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new leave request' })
  @ApiResponse({
    status: 201,
    description: 'Leave request created successfully',
  })
  async create(@Body() dto: CreateLeaveDto, @Request() req:any) {
    console.log('>> req.user =', req.user);
    return this.leaveService.createLeave(req.user.id, dto);
  }

  @Get()
   @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all leave requests (filtered by user_id)' })
  @ApiResponse({
    status: 200,
    description: 'Returns leave requests',
  })
  async find(@Query('userId') userId?: string) {
    return this.leaveService.getLeaves(userId);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Approve or reject a leave request (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Leave status updated successfully',
  })
  @ApiBody({
    description: 'Status update payload',
    schema: {
      example: {
        status: 'approved', // or 'rejected'
      },
    },
  })
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateLeaveDto, @Request() req) {
    return this.leaveService.updateStatus(id, dto.status, req.user.tenant_id);
  }
}





