import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssetSubcategory } from '../../entities/asset-subcategory.entity';
import { AssetCategory } from '../../entities/asset-category.entity';
import { CreateAssetSubcategoryDto } from './dto/create-asset-subcategory.dto';
import { UpdateAssetSubcategoryDto } from './dto/update-asset-subcategory.dto';

const GLOBAL = '00000000-0000-0000-0000-000000000000';

@Injectable()
export class AssetSubcategoryService {
  constructor(
    @InjectRepository(AssetSubcategory)
    private readonly subcategoryRepo: Repository<AssetSubcategory>,
    @InjectRepository(AssetCategory)
    private readonly categoryRepo: Repository<AssetCategory>,
  ) {}

  async create(dto: CreateAssetSubcategoryDto, tenantId: string) {
    // Verify category exists and belongs to tenant
    const category = await this.categoryRepo.findOne({
      where: { id: dto.categoryId, tenant_id: tenantId },
    });

    if (!category) {
      // Try global category
      const globalCategory = await this.categoryRepo.findOne({
        where: { id: dto.categoryId, tenant_id: GLOBAL },
      });

      if (!globalCategory) {
        throw new NotFoundException('Category not found');
      }
    }

    // Check if subcategory with same name and category already exists
    const existing = await this.subcategoryRepo.findOne({
      where: {
        name: dto.name,
        category_id: dto.categoryId,
        tenant_id: tenantId,
      },
    });

    if (existing) {
      throw new ConflictException('Subcategory with this name and category already exists');
    }

    const entity = this.subcategoryRepo.create({
      name: dto.name,
      category_id: dto.categoryId,
      description: dto.description ?? null,
      tenant_id: tenantId,
    });

    return await this.subcategoryRepo.save(entity);
  }

  async findAll(tenantId: string, categoryId?: string) {
    const qb = this.subcategoryRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.category', 'category')
      .where('s.tenant_id IN (:...tenants)', { tenants: [GLOBAL, tenantId] })
      .orderBy('category.name', 'ASC')
      .addOrderBy('s.name', 'ASC');

    if (categoryId) {
      qb.andWhere('s.category_id = :categoryId', { categoryId });
    }

    return await qb.getMany();
  }

  async findOne(tenantId: string, id: string) {
    const subcategory = await this.subcategoryRepo.findOne({
      where: { 
        id, 
        tenant_id: tenantId === GLOBAL ? GLOBAL : tenantId 
      },
    });

    if (!subcategory) {
      // Try to find in GLOBAL tenant if not found in user's tenant
      if (tenantId !== GLOBAL) {
        const globalSubcategory = await this.subcategoryRepo.findOne({
          where: { id, tenant_id: GLOBAL },
        });
        
        if (globalSubcategory) {
          return globalSubcategory;
        }
      }
      
      throw new NotFoundException('Subcategory not found');
    }

    return subcategory;
  }

  async update(tenantId: string, id: string, dto: UpdateAssetSubcategoryDto) {
    const subcategory = await this.findOne(tenantId, id);

    // Prevent modification of GLOBAL tenant subcategories
    if (subcategory.tenant_id === GLOBAL && tenantId !== GLOBAL) {
      throw new ConflictException('Cannot modify global subcategories');
    }

    // If categoryId is being updated, verify it exists
    if (dto.categoryId) {
      const category = await this.categoryRepo.findOne({
        where: { id: dto.categoryId, tenant_id: tenantId },
      });

      if (!category) {
        const globalCategory = await this.categoryRepo.findOne({
          where: { id: dto.categoryId, tenant_id: GLOBAL },
        });

        if (!globalCategory) {
          throw new NotFoundException('Category not found');
        }
      }
    }

    // Check if updating name/category would create a duplicate
    const categoryIdToCheck = dto.categoryId ?? subcategory.category_id;
    if (dto.name || dto.categoryId) {
      const existing = await this.subcategoryRepo.findOne({
        where: {
          name: dto.name ?? subcategory.name,
          category_id: categoryIdToCheck,
          tenant_id: tenantId,
        },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException('Subcategory with this name and category already exists');
      }
    }

    Object.assign(subcategory, {
      name: dto.name ?? subcategory.name,
      category_id: dto.categoryId ?? subcategory.category_id,
      description: dto.description ?? subcategory.description,
    });

    return await this.subcategoryRepo.save(subcategory);
  }

  async remove(tenantId: string, id: string) {
    const subcategory = await this.findOne(tenantId, id);
    
    // Prevent deletion of GLOBAL tenant subcategories
    if (subcategory.tenant_id === GLOBAL && tenantId !== GLOBAL) {
      throw new ConflictException('Cannot delete global subcategories');
    }

    // Check if subcategory is in use by assets
    const assetsCount = await this.subcategoryRepo.manager
      .createQueryBuilder()
      .from('assets', 'a')
      .where('a.subcategory_id = :id', { id })
      .getCount();

    if (assetsCount > 0) {
      throw new ConflictException(
        `Cannot delete subcategory. It is being used by ${assetsCount} asset(s)`
      );
    }

    // Check if subcategory is in use by requests
    const requestsCount = await this.subcategoryRepo.manager
      .createQueryBuilder()
      .from('asset_requests', 'r')
      .where('r.subcategory_id = :id', { id })
      .getCount();

    if (requestsCount > 0) {
      throw new ConflictException(
        `Cannot delete subcategory. It is being used by ${requestsCount} request(s)`
      );
    }
    
    await this.subcategoryRepo.remove(subcategory);
    return { message: 'Subcategory deleted successfully' };
  }
}
