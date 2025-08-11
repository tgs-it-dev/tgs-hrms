import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { ProfileService } from './profile.service';
import { Request } from 'express';

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
}