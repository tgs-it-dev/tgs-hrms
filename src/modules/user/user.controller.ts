import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { TenantGuard } from '../../guards/jwt-auth.guard';
import { Roles } from '../../decorators/roles.decorator';

/**
 * UserController exposes endpoints for user management.
 *
 * Security:
 * - Protected by JwtAuthGuard, RolesGuard, and TenantGuard to ensure only authenticated,
 *   authorized, and tenant-matching users can access endpoints.
 * - @Roles('admin') restricts access to admin users only.
 */
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
  @Roles('admin')
  getUsers() {
    return this.userService.findAll();
  }
}
