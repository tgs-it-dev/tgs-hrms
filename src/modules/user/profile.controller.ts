import { Controller, Get, UseGuards, Req, Body, Put } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { ProfileService } from './profile.service';
import { Request } from 'express';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AuthService } from '../auth/auth.service';
import { UnauthorizedException, InternalServerErrorException } from '@nestjs/common';
@ApiTags('Profile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('profile')
export class ProfileController {
  constructor(
    private readonly profileService: ProfileService,
    private readonly authService: AuthService
  ) {}

  @Get('me')
  async getMyProfile(@Req() req: Request) {
    // user is attached to req by JwtAuthGuard
    const userId = (req.user as any).id;
    return this.profileService.getUserProfile(userId);
  }

  @Put('me')
  async updateMyProfile(@Req() req: Request, @Body() dto: UpdateProfileDto) {
    const userId = (req.user as any).id;
    return this.profileService.updateUserProfile(userId, dto);
  }

  @ApiBearerAuth()
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req: any) {
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