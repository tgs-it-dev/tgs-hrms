
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Role } from 'src/entities/role.entity'; 
import { Repository } from 'typeorm';

@Injectable()
export class AdminOnlyGuard implements CanActivate {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.role_id) {
      throw new ForbiddenException('User role not found.');
    }

    const role = await this.roleRepository.findOne({
      where: { id: user.role_id },
    });

    if (!role || role.name.toLowerCase() !== 'admin') {
      throw new ForbiddenException('Only admin users can perform this action.');
    }

    return true;
  }
}
