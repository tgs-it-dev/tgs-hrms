import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssetSubcategory } from '../../entities/asset-subcategory.entity';
import { CreateAssetSubcategoryDto } from './dto/create-asset-subcategory.dto';
import { UpdateAssetSubcategoryDto } from './dto/update-asset-subcategory.dto';

const GLOBAL = '00000000-0000-0000-0000-000000000000';

@Injectable()
export class AssetSubcategoryService {
  constructor(
    @InjectRepository(AssetSubcategory)
    private readonly subcategoryRepo: Repository<AssetSubcategory>,
  ) {}

  async create(dto: CreateAssetSubcategoryDto, tenantId: string) {
    // Check if subcategory with same name and category already exists
    const existing = await this.subcategoryRepo.findOne({
      where: {
        name: dto.name,
        category: dto.category,
        tenant_id: tenantId,
      },
    });

    if (existing) {
      throw new ConflictException('Subcategory with this name and category already exists');
    }

    const entity = this.subcategoryRepo.create({
      name: dto.name,
      category: dto.category,
      description: dto.description ?? null,
      tenant_id: tenantId,
    });

    return await this.subcategoryRepo.save(entity);
  }

  async findAll(tenantId: string, category?: string) {
    const qb = this.subcategoryRepo
      .createQueryBuilder('s')
      .where('s.tenant_id IN (:...tenants)', { tenants: [GLOBAL, tenantId] })
      .orderBy('s.category', 'ASC')
      .addOrderBy('s.name', 'ASC');

    if (category) {
      const trimmedCategory = category.trim();
      qb.andWhere('LOWER(s.category) = LOWER(:category)', { category: trimmedCategory });
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

    // Check if updating name/category would create a duplicate
    if (dto.name || dto.category) {
      const existing = await this.subcategoryRepo.findOne({
        where: {
          name: dto.name ?? subcategory.name,
          category: dto.category ?? subcategory.category,
          tenant_id: tenantId,
        },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException('Subcategory with this name and category already exists');
      }
    }

    Object.assign(subcategory, {
      name: dto.name ?? subcategory.name,
      category: dto.category ?? subcategory.category,
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
    
    await this.subcategoryRepo.remove(subcategory);
    return { message: 'Subcategory deleted successfully' };
  }

  async getCategories(tenantId: string) {
    const categories = await this.subcategoryRepo
      .createQueryBuilder('s')
      .select('DISTINCT s.category', 'category')
      .where('s.tenant_id IN (:...tenants)', { tenants: [GLOBAL, tenantId] })
      .orderBy('s.category', 'ASC')
      .getRawMany();

    return categories.map(c => c.category);
  }
}
