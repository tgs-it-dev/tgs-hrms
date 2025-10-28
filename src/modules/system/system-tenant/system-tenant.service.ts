import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Tenant } from "src/entities/tenant.entity";
import { Repository, QueryFailedError, FindOptionsWhere, ILike } from "typeorm";
import { CreateTenantDto } from "../dto/system-tenant/create-tenant.dto";

@Injectable()
export class SystemTenantService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
  ) {}

  async create(dto: CreateTenantDto) {
    // Check for existing tenant name (case-insensitive)
    const existing = await this.tenantRepo.findOne({
      where: {
        name: ILike(dto.name),
        isDeleted: false,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Tenant with name '${dto.name}' already exists.`,
      );
    }

    try {
      const tenant = this.tenantRepo.create({
        ...dto,
      });
      return await this.tenantRepo.save(tenant);
    } catch (err: unknown) {
      if (err instanceof QueryFailedError) {
        const code: unknown = (err as QueryFailedError & { code?: string })
          .code;
        if (code === "23505") {
          throw new ConflictException("Tenant name must be unique.");
        }
        if (code === "23502") {
          throw new BadRequestException("Missing required fields.");
        }
      }
      throw err;
    }
  }

  async updateStatus(id: string, status: "active" | "suspended") {
    const tenant = await this.findOne(id);

    tenant.status = status;

    return await this.tenantRepo.save(tenant);
  }

  /**
   * Get paginated list of tenants
   */
  async findAll(page: number = 1, includeDeleted: boolean = false) {
    const limit = 25;
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<Tenant> = includeDeleted
      ? {}
      : { isDeleted: false };

    const data = await this.tenantRepo.find({
      where,
      order: { created_at: "DESC" },
      skip,
      take: limit,
    });

    return data;
  }

  /**
   * Find tenant by ID
   */
  async findOne(id: string, relations: string[] = []) {
    const tenant = await this.tenantRepo.findOne({
      where: { id, isDeleted: false },
      relations,
    });

    if (!tenant) {
      throw new NotFoundException("Tenant not found.");
    }

    return tenant;
  }

  /**
   * Get full tenant details with departments, employee count
   */
  async getTenantDetails(id: string) {
    const tenant = await this.findOne(id, ["departments", "users"]);

    if (!tenant) {
      throw new NotFoundException("Tenant not found.");
    }

    const departmentCount = tenant.departments.length || 0;
    const employeeCount = tenant.users.length || 0;

    return {
      id: tenant.id,
      name: tenant.name,
      status: tenant.status,
      created_at: tenant.created_at,
      departmentCount,
      employeeCount,
      departments: tenant.departments.map((d) => ({
        id: d.id,
        name: d.name,
      })),
    };
  }

  async remove(id: string) {
    const tenant = await this.findOne(id);

    tenant.isDeleted = true;
    tenant.deleted_at = new Date();
    await this.tenantRepo.save(tenant);

    return { deleted: true, id };
  }

  async restore(id: string) {
    const tenant = await this.tenantRepo.findOne({
      where: { id, isDeleted: true },
    });

    if (!tenant) {
      throw new NotFoundException("Tenant not found or not deleted.");
    }

    tenant.isDeleted = false;
    tenant.deleted_at = null;

    await this.tenantRepo.save(tenant);

    return { restored: true, id };
  }
}
