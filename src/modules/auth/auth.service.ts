import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private jwtService: JwtService,
  ) {}

  
  async register(dto: RegisterDto) {
    const { email, password, tenantId, role } = dto;

    const existing = await this.userRepo.findOne({ where: { email } });
    if (existing) {
      throw new BadRequestException('User already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = this.userRepo.create({
      email,
      password: hashedPassword,
      tenantId,
      role,
    });

    const savedUser = await this.userRepo.save(newUser);

    const { password: _, ...userWithoutPassword } = savedUser;

    return {
      message: 'User registered successfully',
      user: userWithoutPassword,
    };
  }


  async validateUser(email: string, password: string) {
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    };

    const { password: _, ...userWithoutPassword } = user;

    return {
      accessToken: this.jwtService.sign(payload),
      user: userWithoutPassword,
    };
  }
}
