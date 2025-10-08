import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import { ReadStream } from 'fs';
import { User } from 'src/entities/user.entity';
import { Role } from 'src/entities/role.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { PaginationResponse } from '../../common/interfaces/pagination.interface';
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
  ) {}
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
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    const user = this.userRepo.create({
      ...createUserDto,
      password: hashedPassword,
      tenant_id: tenantId,
      role_id: createUserDto.role_id,
      role,
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

  async updateUserRole(userId: string, dto: UpdateUserRoleDto, tenantId: string, currentUserId: string) {
    // Validate the role exists
    const role = await this.roleRepo.findOne({ where: { id: dto.role_id } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    // Find the user
    const user = await this.findOne(userId, tenantId, currentUserId);
    
    // Update the role
    user.role_id = dto.role_id;
    user.role = role;
    
    return this.userRepo.save(user);
  }
  async remove(userId: string, tenantId: string, currentUserId: string) {
    const user = await this.findOne(userId, tenantId, currentUserId);
    return this.userRepo.remove(user);
  }
  async updateProfilePicture(userId: string, file: Express.Multer.File, tenantId: string) {
    const user = await this.findOne(userId, tenantId, userId);
    // Delete old profile picture if exists
    if (user.profile_pic) {
      await this.fileUploadService.deleteProfilePicture(user.profile_pic);
    }
    // Upload new profile picture
    const profilePicUrl = await this.fileUploadService.uploadProfilePicture(file, userId);
    // Update user record
    user.profile_pic = profilePicUrl;
    return this.userRepo.save(user);
  }
  async removeProfilePicture(userId: string, tenantId: string) {
    const user = await this.findOne(userId, tenantId, userId);
    if (user.profile_pic) {
      await this.fileUploadService.deleteProfilePicture(user.profile_pic);
      user.profile_pic = null;
      return this.userRepo.save(user);
    }
    return user;
  }
  // :white_tick: FIXED: Public method to get profile picture (no authentication required)
  async getProfilePicture(userId: string) {
    try {
      this.logger.debug(`Getting profile picture for user: ${userId}`);
      // Get user to find their profile picture URL
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
      // Construct the file path
      const uploadDir = path.join(process.cwd(), 'public', 'profile-pictures');
      const fileName = user.profile_pic.split('/').pop(); // Extract filename from URL
      if (!fileName) {
        this.logger.warn(`Invalid profile picture URL: ${user.profile_pic}`);
        return null;
      }
      const filePath = path.join(uploadDir, fileName);
      this.logger.debug(`Profile picture file path: ${filePath}`);
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        this.logger.warn(`Profile picture file not found: ${filePath}`);
        return null;
      }
      // Get file stats
      const stats = fs.statSync(filePath);
      const fileExtension = path.extname(filePath).toLowerCase();
      this.logger.debug(`Profile picture stats: size=${stats.size}, ext=${fileExtension}`);
      // Set appropriate content type
      let contentType = 'image/jpeg'; // default
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
      // Create file stream
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
