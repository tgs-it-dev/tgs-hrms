import { Controller, Get, Req, Body, Put } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ProfileService } from '../services/profile.service';
import { UpdateProfileDto } from '../dto/user.dto';
import { AuthService } from '../../auth/auth.service';
import {
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { AuthenticatedRequest } from '../../../common/types/request.types';
@ApiTags('Profile')
@ApiBearerAuth()
@Controller('profile')
export class ProfileController {
  constructor(
    private readonly profileService: ProfileService,
    private readonly authService: AuthService,
  ) {}

  @Get('me')
  async getMyProfile(@Req() req: AuthenticatedRequest) {
    const userId = req.user.id;
    return this.profileService.getUserProfile(userId);
  }

  @Put('me')
  async updateMyProfile(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateProfileDto,
  ) {
    const userId = req.user.id;
    return this.profileService.updateUserProfile(userId, dto);
  }

  @ApiBearerAuth()
  @Get('profile')
  async getProfile(@Req() req: AuthenticatedRequest) {
    try {
      const user = await this.authService.validateToken(req.user.id);
      return user.user;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch profile');
    }
  }
}
