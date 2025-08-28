// // src/modules/user/user.controller.ts

// import {
//   Controller,
//   Get,
//   Post,
//   Body,
//   Patch,
//   Param,
//   Delete,
//   UseGuards,
//   HttpException,
//   HttpStatus,
//   Req,
//   Query,
//   UseInterceptors,
//   UploadedFile,
//   Res,
// } from '@nestjs/common';
// import { Response } from 'express';
// import { UserService } from './user.service';
// import { CreateUserDto } from './dto/create-user.dto';
// import { UpdateUserDto } from './dto/update-user.dto';
// import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
// import { Roles } from 'src/common/decorators/roles.decorator';
// import { RolesGuard } from 'src/common/guards/roles.guard';
// import { TenantId } from 'src/common/decorators/company.deorator';
// import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
// import { FileInterceptor } from '@nestjs/platform-express';
// import { ParseFilePipe, MaxFileSizeValidator, FileTypeValidator } from '@nestjs/common';

// @ApiTags('Users')
// @ApiBearerAuth()
// @UseGuards(JwtAuthGuard, RolesGuard)
// @Controller('users')
// export class UserController {
//   constructor(private readonly userService: UserService) {}

//   @Post()
//   @Roles('system-admin')
//   async create(@Body() dto: CreateUserDto, @TenantId() tenantId: string) {
//     try {
//       const user = await this.userService.create(dto, tenantId);
//       return { message: 'User created successfully', user };
//     } catch (error) {
//       throw new HttpException(
//         'Error creating user: ' + error.message,
//         HttpStatus.BAD_REQUEST,
//       );
//     }
//   }

//   @Get()
//   @Roles('system-admin', 'admin')
//   async findAll(@TenantId() tenantId: string, @Req() req, @Query('page') page?: string) {
//     try {
//       const pageNumber = Math.max(1, parseInt(page || '1', 10) || 1);
//       const users = await this.userService.findAll(tenantId, req.user.userId, pageNumber);
//       if (!users || users.items.length === 0) {
//         throw new HttpException('No users found for this tenant', HttpStatus.NOT_FOUND);
//       }
//       return { message: 'Users fetched successfully', users };
//     } catch (error) {
//       throw new HttpException(
//         'Error fetching users: ' + error.message,
//         HttpStatus.INTERNAL_SERVER_ERROR,
//       );
//     }
//   }

//   @Get(':id')
//   @Roles('system-admin', 'admin')
//   async findOne(@Param('id') id: string, @TenantId() tenantId: string, @Req() req) {
//     try {
//       const user = await this.userService.findOne(id, tenantId, req.user.userId);
//       return { message: 'User fetched successfully', user };
//     } catch (error) {
//       throw new HttpException(
//         'Error fetching user: ' + error.message,
//         HttpStatus.INTERNAL_SERVER_ERROR,
//       );
//     }
//   }

//   @Get(':id/profile-picture')
//   async getProfilePicture(
//     @Param('id') id: string,
//     @Res() res: Response,
//   ) {
//     try {
//       const profilePictureData = await this.userService.getProfilePicture(id);
//       console.log(profilePictureData,"Profile Pic is COming")
//       if (!profilePictureData) {
//         return res.status(404).json({ message: 'Profile picture not found' });
//       }

//       // Set appropriate headers
//       res.setHeader('Content-Type', profilePictureData.contentType);
//       res.setHeader('Content-Length', profilePictureData.fileSize);
//       res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
//       res.setHeader('Access-Control-Allow-Origin', '*');
      
//       // Stream the file
//       profilePictureData.fileStream.pipe(res);
//     } catch (error) {
//       console.error('Error serving profile picture:', error);
//       return res.status(500).json({ message: 'Error serving profile picture' });
//     }
//   }

//   @Patch(':id')
//   @Roles('system-admin', 'admin')
//   async update(
//     @Param('id') id: string,
//     @Body() dto: UpdateUserDto,
//     @TenantId() tenantId: string,
//     @Req() req,
//   ) {
//     try {
//       const updatedUser = await this.userService.update(id, dto, tenantId, req.user.userId);
//       return { message: 'User updated successfully', updatedUser };
//     } catch (error) {
//       throw new HttpException(
//         'Error updating user: ' + error.message,
//         HttpStatus.INTERNAL_SERVER_ERROR,
//       );
//     }
//   }

//   @Delete(':id')
//   @Roles('system-admin', 'admin')
//   async remove(@Param('id') id: string, @TenantId() tenantId: string, @Req() req) {
//     try {
//       const deleted = await this.userService.remove(id, tenantId, req.user.userId);
//       if (!deleted) {
//         throw new HttpException(
//           `User with ID ${id} not found or deletion failed`,
//           HttpStatus.NOT_FOUND,
//         );
//       }
//       return { message: 'User has been deleted successfully.' };
//     } catch (error) {
//       throw new HttpException(
//         'Error deleting user: ' + error.message,
//         HttpStatus.INTERNAL_SERVER_ERROR,
//       );
//     }
//   }

//   // @Post(':id/profile-picture')
//   // @UseInterceptors(FileInterceptor('profile_pic'))
//   // async uploadProfilePicture(
//   //   @Param('id') id: string,
//   //   @UploadedFile(
//   //     new ParseFilePipe({
//   //       validators: [
//   //         new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
//   //         new FileTypeValidator({ fileType: '.(jpg|jpeg|png|gif)' }),
//   //       ],
//   //     }),
//   //   )
//   //   file: Express.Multer.File,
//   //   @TenantId() tenantId: string,
//   //   @Req() req,
//   // ) {
//   //   try {
//   //     // Only allow users to update their own profile picture
//   //     if (id !== req.user.userId) {
//   //       throw new HttpException('You can only update your own profile picture', HttpStatus.FORBIDDEN);
//   //     }

//   //     const updatedUser = await this.userService.updateProfilePicture(id, file, tenantId);
//   //     return { message: 'Profile picture updated successfully', user: updatedUser };
//   //   } catch (error) {
//   //     throw new HttpException(
//   //       'Error updating profile picture: ' + error.message,
//   //       HttpStatus.BAD_REQUEST,
//   //     );
//   //   }
//   // }

//   @Post(':id/profile-picture')
//   @UseInterceptors(FileInterceptor('profile_pic'))
//   async uploadProfilePicture(
//     @Param('id') id: string,
//     @UploadedFile(
//       new ParseFilePipe({
//         validators: [
//           new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
//           new FileTypeValidator({ fileType: '.(jpg|jpeg|png|gif)' }),
//         ],
//       }),
//     )
//     file: Express.Multer.File,
//     @TenantId() tenantId: string,
//     @Req() req,
//   ) {
//     try {
//       // Check multiple possible user ID fields
//       const authenticatedUserId = req.user?.userId || req.user?.id || req.user?.sub;
//       console.log('Backend Debug:', {
//         paramId: id,
//         authenticatedUserId,
//         reqUser: req.user,
//         match: id === authenticatedUserId
//       });
//       if (id !== authenticatedUserId) {
//         throw new HttpException('You can only update your own profile picture', HttpStatus.FORBIDDEN);
//       }
//       const updatedUser = await this.userService.updateProfilePicture(id, file, tenantId);
//       return { message: 'Profile picture updated successfully', user: updatedUser };
//     } catch (error) {
//       throw new HttpException(
//         'Error updating profile picture: ' + error.message,
//         HttpStatus.BAD_REQUEST,
//       );
//     }
//   }





//   @Delete(':id/profile-picture')
//   async removeProfilePicture(
//     @Param('id') id: string,
//     @TenantId() tenantId: string,
//     @Req() req,
//   ) {
//     try {
//       // Check multiple possible user ID fields
//       const authenticatedUserId = req.user?.userId || req.user?.id || req.user?.sub;
//       if (id !== authenticatedUserId) {
//         throw new HttpException('You can only remove your own profile picture', HttpStatus.FORBIDDEN);
//       }

//       const updatedUser = await this.userService.removeProfilePicture(id, tenantId);
//       return { message: 'Profile picture removed successfully', user: updatedUser };
//     } catch (error) {
//       throw new HttpException(
//         'Error removing profile picture: ' + error.message,
//         HttpStatus.BAD_REQUEST,
//       );
//     }
//   }
// }








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
  UseInterceptors,
  UploadedFile,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { TenantId } from 'src/common/decorators/company.deorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { ParseFilePipe, MaxFileSizeValidator, FileTypeValidator } from '@nestjs/common';
@ApiTags('Users')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}
  // :white_tick: PUBLIC ENDPOINT - No authentication required
  @Get(':id/profile-picture')
  async getProfilePicture(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    try {
      console.log(':file_folder: Profile picture request for user:', id);
      const profilePictureData = await this.userService.getProfilePicture(id);
      if (!profilePictureData) {
        console.log(':x: Profile picture not found for user:', id);
        return res.status(404).json({ message: 'Profile picture not found' });
      }
      console.log(':white_tick: Profile picture found:', {
        userId: id,
        fileName: profilePictureData.fileName,
        fileSize: profilePictureData.fileSize,
        contentType: profilePictureData.contentType
      });
      // Set appropriate headers
      res.setHeader('Content-Type', profilePictureData.contentType);
      res.setHeader('Content-Length', profilePictureData.fileSize);
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      // Stream the file
      profilePictureData.fileStream.pipe(res);
    } catch (error) {
      console.error(':x: Error serving profile picture:', error);
      return res.status(500).json({ message: 'Error serving profile picture' });
    }
  }
  // :white_tick: PROTECTED ENDPOINTS - Require authentication
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post(':id/profile-picture')
  @UseInterceptors(FileInterceptor('profile_pic'))
  async uploadProfilePicture(
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          new FileTypeValidator({ fileType: '.(jpg|jpeg|png|gif)' }),
        ],
      }),
    )
    file: Express.Multer.File,
    @TenantId() tenantId: string,
    @Req() req,
  ) {
    try {
      // Check multiple possible user ID fields
      const authenticatedUserId = req.user?.userId || req.user?.id || req.user?.sub;
      console.log('Backend Debug:', {
        paramId: id,
        authenticatedUserId,
        reqUser: req.user,
        match: id === authenticatedUserId
      });
      if (id !== authenticatedUserId) {
        throw new HttpException('You can only update your own profile picture', HttpStatus.FORBIDDEN);
      }
      const updatedUser = await this.userService.updateProfilePicture(id, file, tenantId);
      return { message: 'Profile picture updated successfully', user: updatedUser };
    } catch (error) {
      throw new HttpException(
        'Error updating profile picture: ' + error.message,
        HttpStatus.BAD_REQUEST,
      );
    }
  }
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete(':id/profile-picture')
  async removeProfilePicture(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Req() req,
  ) {
    try {
      // Check multiple possible user ID fields
      const authenticatedUserId = req.user?.userId || req.user?.id || req.user?.sub;
      if (id !== authenticatedUserId) {
        throw new HttpException('You can only remove your own profile picture', HttpStatus.FORBIDDEN);
      }
      const updatedUser = await this.userService.removeProfilePicture(id, tenantId);
      return { message: 'Profile picture removed successfully', user: updatedUser };
    } catch (error) {
      throw new HttpException(
        'Error removing profile picture: ' + error.message,
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}