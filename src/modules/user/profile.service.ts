import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../../entities/user.entity';
import { Repository } from 'typeorm';

@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async getUserProfile(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['role', 'tenant'],
    });
    if (!user) throw new NotFoundException('User not found');
    // Only return general info, not employee-specific
    return {
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      phone: user.phone,
      profile_pic: user.profile_pic,
      role: user.role?.name,
      tenant: user.tenant?.name,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }
}