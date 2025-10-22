import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssetSubcategory } from '../../entities/asset-subcategory.entity';
import { CreateAssetSubcategoryDto } from './dto/create-asset-subcategory.dto';
import { UpdateAssetSubcategoryDto } from './dto/update-asset-subcategory.dto';

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

  async findAll(tenantId: string, category?: string, page = 1) {
    const limit = 25;
    const skip = (page - 1) * limit;

    const qb = this.subcategoryRepo
      .createQueryBuilder('s')
      .where('s.tenant_id = :tenantId', { tenantId })
      .orderBy('s.category', 'ASC')
      .addOrderBy('s.name', 'ASC');

    if (category) {
      const trimmedCategory = category.trim();
      qb.andWhere('LOWER(s.category) = LOWER(:category)', { category: trimmedCategory });
    }

    const [items, total] = await qb
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const totalPages = Math.ceil(total / limit);

    return {
      items,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async findOne(tenantId: string, id: string) {
    const subcategory = await this.subcategoryRepo.findOne({
      where: { id, tenant_id: tenantId },
    });

    if (!subcategory) {
      throw new NotFoundException('Subcategory not found');
    }

    return subcategory;
  }

  async update(tenantId: string, id: string, dto: UpdateAssetSubcategoryDto) {
    const subcategory = await this.findOne(tenantId, id);

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
    await this.subcategoryRepo.remove(subcategory);
    return { message: 'Subcategory deleted successfully' };
  }

  async getCategories(tenantId: string) {
    const categories = await this.subcategoryRepo
      .createQueryBuilder('s')
      .select('DISTINCT s.category', 'category')
      .where('s.tenant_id = :tenantId', { tenantId })
      .orderBy('s.category', 'ASC')
      .getRawMany();

    return categories.map(c => c.category);
  }
}
