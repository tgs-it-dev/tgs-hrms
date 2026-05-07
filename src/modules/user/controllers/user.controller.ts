
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Put,
  UseGuards,
  HttpException,
  HttpStatus,
  Req,
  Query,
  UseInterceptors,
  UploadedFile,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthenticatedRequest } from '../../../common/types/request.types';
import { UserService } from '../services/user.service';
import { CreateUserDto, UpdateUserDto } from '../dto/user.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Public } from 'src/common/decorators/public.decorator';
import { TenantId } from 'src/common/decorators/company.deorator';
import { ApiBearerAuth, ApiTags, ApiConsumes, ApiBody, ApiOperation } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { ParseFilePipe, MaxFileSizeValidator, FileTypeValidator } from '@nestjs/common';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { validateImageFile } from '../../../common/utils/file-validation.util';

@ApiTags('Users')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) { }


  @Get(':id/profile-picture')
  @Public()
  async getProfilePicture(@Param('id') id: string, @Res() res: Response) {
    try {
      const profilePictureData = await this.userService.getProfilePicture(id);
      if (!profilePictureData) {
        return res.status(404).json({ message: 'Profile picture not found' });
      }

      res.setHeader('Content-Type', profilePictureData.contentType);
      res.setHeader('Content-Length', profilePictureData.fileSize);
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      profilePictureData.fileStream.pipe(res);
      return;
    } catch (error) {
      return res.status(500).json({ message: 'Error serving profile picture' });
    }
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Post()
  @Roles('system-admin', 'admin')
  @Permissions('manage_users')
  async create(@Body() dto: CreateUserDto, @TenantId() tenantId: string) {
    try {
      const user = await this.userService.create(dto, tenantId);
      return { message: 'User created successfully', user };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new HttpException('Error creating user: ' + errorMessage, HttpStatus.BAD_REQUEST);
    }
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Get()
  @Roles('system-admin', 'admin', 'manager')
  @Permissions('manage_users', 'view_team_reports')
  async findAll(@TenantId() tenantId: string, @Req() req: AuthenticatedRequest, @Query('page') page?: string) {
    try {
      const pageNumber = Math.max(1, parseInt(page || '1', 10) || 1);
      const users = await this.userService.findAll(tenantId, req.user.id, pageNumber);
      if (!users || users.items.length === 0) {
        throw new HttpException('No users found for this tenant', HttpStatus.NOT_FOUND);
      }
      return { message: 'Users fetched successfully', users };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new HttpException(
        'Error fetching users: ' + errorMessage,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Get(':id')
  @Roles('system-admin', 'admin', 'manager')
  @Permissions('manage_users', 'view_team_reports')
  async findOne(@Param('id') id: string, @TenantId() tenantId: string, @Req() req: AuthenticatedRequest) {
    try {
      const user = await this.userService.findOne(id, tenantId, req.user.id);
      return { message: 'User fetched successfully', user };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new HttpException(
        'Error fetching user: ' + errorMessage,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Patch(':id')
  @Roles('system-admin', 'admin')
  @Permissions('manage_users')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @TenantId() tenantId: string,
    @Req() req: AuthenticatedRequest
  ) {
    try {
      const updatedUser = await this.userService.update(id, dto, tenantId, req.user.id);
      return { message: 'User updated successfully', updatedUser };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new HttpException(
        'Error updating user: ' + errorMessage,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Delete(':id')
  @Roles('system-admin', 'admin')
  @Permissions('manage_users')
  async remove(@Param('id') id: string, @TenantId() tenantId: string, @Req() req: AuthenticatedRequest) {
    try {
      const deleted = await this.userService.remove(id, tenantId, req.user.id);
      if (!deleted) {
        throw new HttpException(
          `User with ID ${id} not found or deletion failed`,
          HttpStatus.NOT_FOUND
        );
      }
      return { message: 'User has been deleted successfully.' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new HttpException(
        'Error deleting user: ' + errorMessage,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post(':id/profile-picture')
  @UseInterceptors(FileInterceptor('profile_pic'))
  @ApiOperation({ summary: 'Upload or update profile picture' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        profile_pic: {
          type: 'string',
          format: 'binary',
          description: 'Profile picture - only JPG, JPEG, PNG, GIF or WebP allowed. JFIF is not accepted.',
        },
      },
    },
  })
  async uploadProfilePicture(
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /^image\/(jpeg|jpg|png|gif|webp)$/ }),
        ],
      })
    )
    file: Express.Multer.File,
    @TenantId() tenantId: string,
    @Req() req: AuthenticatedRequest
  ) {
    validateImageFile(file);
    try {
      const authenticatedUserId = req.user.id;
      const userRole = (req.user.role || '').toLowerCase();
      const isAdmin = ['admin', 'system-admin', 'hr-admin', 'network-admin'].includes(userRole);

      // Allow if self or if user has admin privileges
      if (id !== authenticatedUserId && !isAdmin) {
        throw new HttpException(
          'You can only update your own profile picture',
          HttpStatus.FORBIDDEN
        );
      }
      const updatedUser = await this.userService.updateProfilePicture(id, file, tenantId, authenticatedUserId);
      return { message: 'Profile picture updated successfully', user: updatedUser };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new HttpException(
        'Error updating profile picture: ' + errorMessage,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Put(':id/profile-picture')
  @UseInterceptors(FileInterceptor('profile_pic'))
  @ApiOperation({ summary: 'Update profile picture' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        profile_pic: {
          type: 'string',
          format: 'binary',
          description: 'Profile picture - only JPG, JPEG, PNG, GIF or WebP allowed. JFIF is not accepted.',
        },
      },
    },
  })
  async updateProfilePicturePut(
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /^image\/(jpeg|jpg|png|gif|webp)$/ }),
        ],
      })
    )
    file: Express.Multer.File,
    @TenantId() tenantId: string,
    @Req() req: AuthenticatedRequest
  ) {
    validateImageFile(file);
    try {
      const authenticatedUserId = req.user.id;
      const userRole = (req.user.role || '').toLowerCase();
      const isAdmin = ['admin', 'system-admin', 'hr-admin', 'network-admin'].includes(userRole);

      // Allow if self or if user has admin privileges
      if (id !== authenticatedUserId && !isAdmin) {
        throw new HttpException(
          'You can only update your own profile picture',
          HttpStatus.FORBIDDEN
        );
      }
      const updatedUser = await this.userService.updateProfilePicture(id, file, tenantId, authenticatedUserId);
      return { message: 'Profile picture updated successfully', user: updatedUser };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new HttpException(
        'Error updating profile picture: ' + errorMessage,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete(':id/profile-picture')
  async removeProfilePicture(@Param('id') id: string, @TenantId() tenantId: string, @Req() req: AuthenticatedRequest) {
    try {
      const authenticatedUserId = req.user.id;
      const userRole = (req.user.role || '').toLowerCase();
      const isAdmin = ['admin', 'system-admin', 'hr-admin', 'network-admin'].includes(userRole);

      // Allow if self or if user has admin privileges
      if (id !== authenticatedUserId && !isAdmin) {
        throw new HttpException(
          'You can only remove your own profile picture',
          HttpStatus.FORBIDDEN
        );
      }
      const updatedUser = await this.userService.removeProfilePicture(id, tenantId, authenticatedUserId);
      return { message: 'Profile picture removed successfully', user: updatedUser };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new HttpException(
        'Error removing profile picture: ' + errorMessage,
        HttpStatus.BAD_REQUEST
      );
    }
  }
}
