// src/modules/user/user.controller.ts

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpException,
  HttpStatus,
  Req,
  Query,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { TenantId } from 'src/common/decorators/company.deorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @Roles('system-admin')
  async create(@Body() dto: CreateUserDto, @TenantId() tenantId: string) {
    try {
      const user = await this.userService.create(dto, tenantId);
      return { message: 'User created successfully', user };
    } catch (error) {
      throw new HttpException(
        'Error creating user: ' + error.message,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get()
  @Roles('system-admin', 'admin')
  async findAll(@TenantId() tenantId: string, @Req() req, @Query('page') page?: string) {
    try {
      const pageNumber = Math.max(1, parseInt(page || '1', 10) || 1);
      const users = await this.userService.findAll(tenantId, req.user.userId, pageNumber);
      if (!users || users.items.length === 0) {
        throw new HttpException('No users found for this tenant', HttpStatus.NOT_FOUND);
      }
      return { message: 'Users fetched successfully', users };
    } catch (error) {
      throw new HttpException(
        'Error fetching users: ' + error.message,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  @Roles('system-admin', 'admin')
  async findOne(@Param('id') id: string, @TenantId() tenantId: string, @Req() req) {
    try {
      const user = await this.userService.findOne(id, tenantId, req.user.userId);
      return { message: 'User fetched successfully', user };
    } catch (error) {
      throw new HttpException(
        'Error fetching user: ' + error.message,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch(':id')
  @Roles('system-admin', 'admin')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @TenantId() tenantId: string,
    @Req() req,
  ) {
    try {
      const updatedUser = await this.userService.update(id, dto, tenantId, req.user.userId);
      return { message: 'User updated successfully', updatedUser };
    } catch (error) {
      throw new HttpException(
        'Error updating user: ' + error.message,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':id')
  @Roles('system-admin', 'admin')
  async remove(@Param('id') id: string, @TenantId() tenantId: string, @Req() req) {
    try {
      const deleted = await this.userService.remove(id, tenantId, req.user.userId);
      if (!deleted) {
        throw new HttpException(
          `User with ID ${id} not found or deletion failed`,
          HttpStatus.NOT_FOUND,
        );
      }
      return { message: 'User has been deleted successfully.' };
    } catch (error) {
      throw new HttpException(
        'Error deleting user: ' + error.message,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
