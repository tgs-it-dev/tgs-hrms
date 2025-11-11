import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Tenant } from "src/entities/tenant.entity";
import {
  Repository,
  QueryFailedError,
  FindOptionsWhere,
  ILike,
  DataSource,
} from "typeorm";
import { CreateTenantDto } from "../dto/system-tenant/create-tenant.dto";
import { User } from "src/entities/user.entity";
import { Role } from "src/entities/role.entity";
import * as bcrypt from "bcrypt";
import { EmailService } from "src/common/utils/email/email.service";
import { CompanyDetails } from "src/entities/company-details.entity";

@Injectable()
export class SystemTenantService {
  private readonly logger = new Logger(SystemTenantService.name);
  private readonly defaultPlanId = "system-manual";

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(CompanyDetails)
    private readonly companyDetailsRepo: Repository<CompanyDetails>,
    private readonly dataSource: DataSource,
    private readonly emailService: EmailService,
  ) {}

  async create(dto: CreateTenantDto) {
    const tenantName = dto.name.trim();
    const domain = dto.domain.trim().toLowerCase();
    const adminName = dto.adminName.trim();
    const normalizedAdminEmail = dto.adminEmail.trim().toLowerCase();

    if (!tenantName) {
      throw new BadRequestException("Tenant name cannot be empty");
    }

    if (!domain) {
      throw new BadRequestException("Domain cannot be empty");
    }

    if (!adminName) {
      throw new BadRequestException("Admin name cannot be empty");
    }

    // Check for existing tenant name (case-insensitive)
    const existing = await this.tenantRepo.findOne({
      where: {
        name: ILike(tenantName),
        isDeleted: false,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Tenant with name '${tenantName}' already exists.`,
      );
    }

    const existingCompanyDetails = await this.companyDetailsRepo.findOne({
      where: { domain: ILike(domain) },
    });

    if (existingCompanyDetails) {
      throw new ConflictException(
        `Company details already exist for domain '${dto.domain}'.`,
      );
    }

    const existingAdmin = await this.userRepo.findOne({
      where: { email: normalizedAdminEmail },
    });

    if (existingAdmin) {
      throw new ConflictException(
        `User with email '${dto.adminEmail}' already exists.`,
      );
    }

    try {
      const {
        tenant,
        admin,
        temporaryPassword,
        company,
      } = await this.dataSource.transaction(async (manager) => {
        const tenantRepository = manager.getRepository(Tenant);
        const userRepository = manager.getRepository(User);
        const roleRepository = manager.getRepository(Role);
        const companyRepository = manager.getRepository(CompanyDetails);

        const tenantToCreate = tenantRepository.create({
          name: tenantName,
        });
        const savedTenant = await tenantRepository.save(tenantToCreate);

        const role = await this.resolveTenantAdminRole(roleRepository);

        const { firstName, lastName } = this.splitName(adminName);
        const password = this.generateTemporaryPassword();
        const hashedPassword = await bcrypt.hash(password, 10);

        const adminToCreate = userRepository.create({
          email: normalizedAdminEmail,
          phone: "",
          password: hashedPassword,
          first_name: firstName,
          last_name: lastName,
          role_id: role.id,
          tenant_id: savedTenant.id,
        });

        const savedAdmin = await userRepository.save(adminToCreate);

        let companyDetails = await companyRepository.findOne({
          where: { tenant_id: savedTenant.id },
        });

        if (!companyDetails) {
          companyDetails = companyRepository.create({
            company_name: tenantName,
            domain,
            plan_id: this.defaultPlanId,
            is_paid: false,
            tenant_id: savedTenant.id,
            logo_url: dto.logo?.trim() || null,
            signup_session_id: null,
          });
        } else {
          companyDetails.company_name = tenantName;
          companyDetails.domain = domain;
          companyDetails.logo_url = dto.logo?.trim() || null;
        }

        const savedCompany = await companyRepository.save(companyDetails);

        return {
          tenant: savedTenant,
          admin: savedAdmin,
          temporaryPassword: password,
          company: savedCompany,
        };
      });

      await this.dispatchAdminCredentialsEmail(
        admin.email,
        adminName,
        tenant.name,
        temporaryPassword,
      );

      return {
        tenant: {
          id: tenant.id,
          name: tenant.name,
          domain: company.domain,
          logo: company.logo_url,
          status: tenant.status,
          created_at: tenant.created_at,
        },
        admin: {
          id: admin.id,
          email: admin.email,
          name: `${admin.first_name} ${admin.last_name}`.trim(),
          temporaryPassword,
          firstLogin: true,
        },
        company: {
          id: company.id,
          company_name: company.company_name,
          domain: company.domain,
          logo_url: company.logo_url,
          is_paid: company.is_paid,
          plan_id: company.plan_id,
          tenant_id: company.tenant_id,
        },
      };
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

  private async resolveTenantAdminRole(roleRepository: Repository<Role>) {
    const tenantAdminRole = await roleRepository.findOne({
      where: { name: ILike("tenant-admin") },
    });

    if (tenantAdminRole) {
      return tenantAdminRole;
    }

    const fallbackAdminRole = await roleRepository.findOne({
      where: { name: ILike("admin") },
    });

    if (!fallbackAdminRole) {
      throw new NotFoundException(
        "Role 'tenant-admin' (or fallback 'admin') must exist before creating a tenant.",
      );
    }

    return fallbackAdminRole;
  }

  private splitName(fullName: string): { firstName: string; lastName: string } {
    const normalized = fullName?.trim() || "";
    if (!normalized) {
      return { firstName: "Tenant", lastName: "Admin" };
    }

    const parts = normalized.split(/\s+/);
    const firstName = parts.shift() ?? "Tenant";
    const lastName = parts.length > 0 ? parts.join(" ") : "Admin";
    return { firstName, lastName };
  }

  private generateTemporaryPassword(): string {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    return Array.from({ length: 12 }, () =>
      chars.charAt(Math.floor(Math.random() * chars.length)),
    ).join("");
  }

  private async dispatchAdminCredentialsEmail(
    email: string,
    adminName: string,
    tenantName: string,
    password: string,
  ) {
    try {
      const subject = `Your ${tenantName} administrator account`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome to ${tenantName}</h2>
          <p>Hello ${adminName || "there"},</p>
          <p>Your administrator account has been created. Use the credentials below to sign in:</p>
          <ul>
            <li><strong>Email:</strong> ${email}</li>
            <li><strong>Temporary Password:</strong> ${password}</li>
          </ul>
          <p>For security purposes, please reset your password after logging in. You'll be redirected to complete your payment on first login.</p>
          <p>If you did not expect this email, please contact our support team.</p>
        </div>
      `;
      await this.emailService.sendEmail(email, subject, html);
    } catch (error) {
      this.logger.error(
        `Failed to send tenant admin credentials email to ${email}: ${String(
          (error as Error)?.message || error,
        )}`,
      );
    }
  }

  async updateStatus(id: string, status: "active" | "suspended") {
    const tenant = await this.findOne(id);

    tenant.status = status;

    return await this.tenantRepo.save(tenant);
  }

  /**
   * Get list of tenants without pagination
   */
  async findAll(includeDeleted: boolean = false) {
    const where: FindOptionsWhere<Tenant> = includeDeleted
      ? {}
      : { isDeleted: false };

    const data = await this.tenantRepo.find({
      where,
      order: { created_at: "DESC" },
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

    const company = await this.companyDetailsRepo.findOne({
      where: { tenant_id: tenant.id },
    });

    const departmentCount = tenant.departments.length || 0;
    const employeeCount = tenant.users.length || 0;

    return {
      id: tenant.id,
      name: tenant.name,
      domain: company?.domain ?? null,
      logo: company?.logo_url ?? null,
      status: tenant.status,
      created_at: tenant.created_at,
      departmentCount,
      employeeCount,
      company: company
        ? {
            id: company.id,
            company_name: company.company_name,
            domain: company.domain,
            logo_url: company.logo_url,
            is_paid: company.is_paid,
            plan_id: company.plan_id,
          }
        : null,
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
