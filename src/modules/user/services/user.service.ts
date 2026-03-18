import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import { User } from 'src/entities/user.entity';
import { Role } from 'src/entities/role.entity';
import { CreateUserDto, UpdateUserDto } from '../dto/user.dto';
import { GLOBAL_SYSTEM_TENANT_ID } from '../../../common/constants/enums';
import { PaginationResponse } from '../../../common/interfaces/pagination.interface';
import { FileUploadService } from './file-upload.service';
@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    private readonly fileUploadService: FileUploadService
  ) { }
  private async isSystemAdmin(userId: string): Promise<boolean> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['role'],
    });
    if (!user) throw new NotFoundException('Authenticated user not found');
    return user.role.name === 'system-admin';
  }
  async create(createUserDto: CreateUserDto, tenantId: string) {
    const role = await this.roleRepo.findOne({
      where: { id: createUserDto.role_id },
    });
    if (!role) throw new NotFoundException('Role not found');

    // System-admin users always get the global system tenant ID
    const finalTenantId = role.name === 'system-admin' ? GLOBAL_SYSTEM_TENANT_ID : tenantId;

    // Validation: Only one system admin is allowed in the entire HRMS
    if (role.name === 'system-admin') {
      const existingSystemAdmin = await this.userRepo.findOne({
        where: {
          role_id: createUserDto.role_id,
          tenant_id: GLOBAL_SYSTEM_TENANT_ID,
        },
      });

      if (existingSystemAdmin) {
        throw new BadRequestException(
          'Only one system admin is allowed in the entire HRMS. A system admin already exists.'
        );
      }
    } else {
      // Check email uniqueness within tenant
      const existingUser = await this.userRepo.findOne({
        where: {
          email: createUserDto.email.toLowerCase(),
          tenant_id: finalTenantId
        }
      });
      if (existingUser) {
        throw new BadRequestException('User with this email already exists in this organization');
      }
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    const user = this.userRepo.create({
      password: hashedPassword,
      tenant_id: finalTenantId,
      role_id: createUserDto.role_id,
      email: createUserDto.email,
      phone: createUserDto.phone,
      first_name: createUserDto.first_name,
      last_name: createUserDto.last_name,
      gender: createUserDto.gender ?? null,
    });
    return this.userRepo.save(user);
  }
  async findAll(
    requestedTenantId: string,
    currentUserId: string,
    page: number = 1
  ): Promise<PaginationResponse<User>> {
    const isAdmin = !(await this.isSystemAdmin(currentUserId));
    const limit = 25;
    const skip = (page - 1) * limit;
    const [items, total] = await this.userRepo.findAndCount({
      where: {
        tenant_id: isAdmin ? requestedTenantId : undefined,
      },
      relations: ['role'],
      skip,
      take: limit,
    });
    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
  async findOne(userId: string, requestedTenantId: string, currentUserId: string) {
    const isAdmin = !(await this.isSystemAdmin(currentUserId));
    const user = await this.userRepo.findOne({
      where: {
        id: userId,
        tenant_id: isAdmin ? requestedTenantId : undefined,
      },
      relations: ['role'],
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
  async update(userId: string, dto: UpdateUserDto, tenantId: string, currentUserId: string) {
    const user = await this.findOne(userId, tenantId, currentUserId);
    Object.assign(user, dto);
    return this.userRepo.save(user);
  }
  async remove(userId: string, tenantId: string, currentUserId: string) {
    const user = await this.findOne(userId, tenantId, currentUserId);
    return this.userRepo.remove(user);
  }
  async updateProfilePicture(userId: string, file: Express.Multer.File, tenantId: string, currentUserId: string) {
    const user = await this.findOne(userId, tenantId, currentUserId);

    if (user.profile_pic) {
      await this.fileUploadService.deleteProfilePicture(user.profile_pic);
    }

    const profilePicUrl = await this.fileUploadService.uploadProfilePicture(file, userId);

    user.profile_pic = profilePicUrl;
    return this.userRepo.save(user);
  }
  async removeProfilePicture(userId: string, tenantId: string, currentUserId: string) {
    const user = await this.findOne(userId, tenantId, currentUserId);
    if (user.profile_pic) {
      await this.fileUploadService.deleteProfilePicture(user.profile_pic);
      user.profile_pic = null;
      return this.userRepo.save(user);
    }
    return user;
  }

  async getProfilePicture(userId: string) {
    try {
      this.logger.debug(`Getting profile picture for user: ${userId}`);

      const user = await this.userRepo.findOne({
        where: { id: userId },
        select: ['id', 'profile_pic'],
      });
      if (!user) {
        this.logger.warn(`User not found: ${userId}`);
        return null;
      }
      if (!user.profile_pic) {
        this.logger.debug(`No profile picture for user: ${userId}`);
        return null;
      }
      this.logger.debug(`User found with profile picture: ${user.id}`);

      const uploadDir = path.join(process.cwd(), 'public', 'profile-pictures');
      const fileName = user.profile_pic.split('/').pop();
      if (!fileName) {
        this.logger.warn(`Invalid profile picture URL: ${user.profile_pic}`);
        return null;
      }
      const filePath = path.join(uploadDir, fileName);
      this.logger.debug(`Profile picture file path: ${filePath}`);

      if (!fs.existsSync(filePath)) {
        this.logger.warn(`Profile picture file not found: ${filePath}`);
        return null;
      }

      const stats = fs.statSync(filePath);
      const fileExtension = path.extname(filePath).toLowerCase();
      this.logger.debug(`Profile picture stats: size=${stats.size}, ext=${fileExtension}`);

      let contentType = 'image/jpeg';
      switch (fileExtension) {
        case '.jpg':
        case '.jpeg':
          contentType = 'image/jpeg';
          break;
        case '.png':
          contentType = 'image/png';
          break;
        case '.gif':
          contentType = 'image/gif';
          break;
        case '.webp':
          contentType = 'image/webp';
          break;
        default:
          contentType = 'image/jpeg';
          break;
      }

      const fileStream = fs.createReadStream(filePath);
      this.logger.debug('Profile picture data prepared');
      return {
        fileStream,
        contentType,
        fileSize: stats.size,
        fileName,
      };
    } catch (error) {
      this.logger.error(`Error getting profile picture: ${String((error as any)?.message || error)}`);
      return null;
    }
  }
}
