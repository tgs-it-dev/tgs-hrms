import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssetCategory } from '../../entities/asset-category.entity';
import { CreateAssetCategoryDto } from './dto/create-asset-category.dto';
import { UpdateAssetCategoryDto } from './dto/update-asset-category.dto';

const GLOBAL = '00000000-0000-0000-0000-000000000000';

@Injectable()
export class AssetCategoryService {
  constructor(
    @InjectRepository(AssetCategory)
    private readonly categoryRepo: Repository<AssetCategory>,
  ) {}

  async create(dto: CreateAssetCategoryDto, tenantId: string) {
    // Check if category with same name already exists
    const existing = await this.categoryRepo.findOne({
      where: {
        name: dto.name,
        tenant_id: tenantId,
      },
    });

    if (existing) {
      throw new ConflictException('Category with this name already exists');
    }

    const entity = this.categoryRepo.create({
      name: dto.name,
      description: dto.description ?? null,
      icon: dto.icon ?? null,
      tenant_id: tenantId,
    });

    return await this.categoryRepo.save(entity);
  }

  async findAll(tenantId: string) {
    return await this.categoryRepo
      .createQueryBuilder('c')
      .where('c.tenant_id IN (:...tenants)', { tenants: [GLOBAL, tenantId] })
      .orderBy('c.name', 'ASC')
      .getMany();
  }

  async findOne(tenantId: string, id: string) {
    const category = await this.categoryRepo.findOne({
      where: { 
        id, 
        tenant_id: tenantId === GLOBAL ? GLOBAL : tenantId 
      },
    });

    if (!category) {
      // Try to find in GLOBAL tenant if not found in user's tenant
      if (tenantId !== GLOBAL) {
        const globalCategory = await this.categoryRepo.findOne({
          where: { id, tenant_id: GLOBAL },
        });
        
        if (globalCategory) {
          return globalCategory;
        }
      }
      
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async update(tenantId: string, id: string, dto: UpdateAssetCategoryDto) {
    const category = await this.findOne(tenantId, id);

    // Prevent modification of GLOBAL tenant categories
    if (category.tenant_id === GLOBAL && tenantId !== GLOBAL) {
      throw new ConflictException('Cannot modify global categories');
    }

    // Check if updating name would create a duplicate
    if (dto.name) {
      const existing = await this.categoryRepo.findOne({
        where: {
          name: dto.name,
          tenant_id: tenantId,
        },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException('Category with this name already exists');
      }
    }

    Object.assign(category, {
      name: dto.name ?? category.name,
      description: dto.description ?? category.description,
      icon: dto.icon ?? category.icon,
    });

    return await this.categoryRepo.save(category);
  }

  async remove(tenantId: string, id: string) {
    const category = await this.findOne(tenantId, id);
    
    // Prevent deletion of GLOBAL tenant categories
    if (category.tenant_id === GLOBAL && tenantId !== GLOBAL) {
      throw new ConflictException('Cannot delete global categories');
    }

    // Check if category is in use by subcategories
    const subcategoriesCount = await this.categoryRepo.manager
      .createQueryBuilder()
      .from('asset_subcategories', 's')
      .where('s.category_id = :id', { id })
      .getCount();

    if (subcategoriesCount > 0) {
      throw new ConflictException(
        `Cannot delete category. It is being used by ${subcategoriesCount} subcategory(ies)`
      );
    }

    // Check if category is in use by assets
    const assetsCount = await this.categoryRepo.manager
      .createQueryBuilder()
      .from('assets', 'a')
      .where('a.category_id = :id', { id })
      .getCount();

    if (assetsCount > 0) {
      throw new ConflictException(
        `Cannot delete category. It is being used by ${assetsCount} asset(s)`
      );
    }

    // Check if category is in use by requests
    const requestsCount = await this.categoryRepo.manager
      .createQueryBuilder()
      .from('asset_requests', 'r')
      .where('r.category_id = :id', { id })
      .getCount();

    if (requestsCount > 0) {
      throw new ConflictException(
        `Cannot delete category. It is being used by ${requestsCount} request(s)`
      );
    }
    
    await this.categoryRepo.remove(category);
    return { message: 'Category deleted successfully' };
  }
}

