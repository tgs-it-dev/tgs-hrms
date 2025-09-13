import { Controller, Get, UseGuards, Req, Body, Put } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { ProfileService } from './profile.service';
import { Request } from 'express';
import { UpdateProfileDto } from './dto/update-profile.dto';

@ApiTags('Profile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

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
}