import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { TenantGuard } from '../../guards/tenant.guard';
import { Roles } from '../../decorators/roles.decorator';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Get all users for the current tenant' })
  @ApiResponse({ 
    status: 200, 
    description: 'List of users retrieved successfully.',
    schema: {
      example: [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          email: 'user@example.com',
          phone: '+1234567890',
          firstName: 'John',
          lastName: 'Doe',
          role: {
            id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
            name: 'admin',
            description: 'Administrator with full access'
          },
          tenant: {
            id: '550e8400-e29b-41d4-a716-446655440000',
            name: 'Default Company'
          },
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z'
        }
      ]
    }
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid or missing JWT token' 
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Forbidden - Insufficient permissions' 
  })
  getUsers() {
    return this.userService.findAll();
  }
}
