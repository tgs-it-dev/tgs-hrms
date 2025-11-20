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
import { UpdateTenantDto } from "../dto/system-tenant/update-tenant.dto";
import { User } from "src/entities/user.entity";
import { Role } from "src/entities/role.entity";
import { Department } from "src/entities/department.entity";
import { PaginationResponse } from "src/common/interfaces/pagination.interface";
import * as bcrypt from "bcrypt";
import * as fs from "fs";
import * as path from "path";
import { EmailService } from "src/common/utils/email/email.service";
import { CompanyDetails } from "src/entities/company-details.entity";
import { SignupSession } from "src/entities/signup-session.entity";

@Injectable()
export class SystemTenantService {
  private readonly logger = new Logger(SystemTenantService.name);
  private readonly defaultPlanId = "system-manual";
  private readonly GLOBAL_TENANT_ID = "00000000-0000-0000-0000-000000000000";

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(Department)
    private readonly departmentRepo: Repository<Department>,
    @InjectRepository(CompanyDetails)
    private readonly companyDetailsRepo: Repository<CompanyDetails>,
    @InjectRepository(SignupSession)
    private readonly signupSessionRepo: Repository<SignupSession>,
    private readonly dataSource: DataSource,
    private readonly emailService: EmailService,
  ) {}

  async create(dto: CreateTenantDto, file?: Express.Multer.File) {
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

    // Handle file upload if provided
    let logoUrl: string | null = null;
    if (file) {
      // Save uploaded file to public/company-logos
      const uploadsDir = path.join(process.cwd(), 'public', 'company-logos');
      if (!fs.existsSync(uploadsDir)) {
        await fs.promises.mkdir(uploadsDir, { recursive: true });
      }

      const timestamp = Date.now();
      const randomNum = Math.floor(Math.random() * 1000000000);
      const fileExtension = path.extname(file.originalname);
      const fileName = `${timestamp}-${randomNum}${fileExtension}`;
      const filePath = path.join(uploadsDir, fileName);

      await fs.promises.writeFile(filePath, file.buffer);
      logoUrl = `/company-logos/${fileName}`;
      this.logger.log(`Logo file saved: ${fileName}`);
    } else if (dto.logo?.trim()) {
      // Use provided logo URL string if no file uploaded
      logoUrl = dto.logo.trim();
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
        signupSession,
      } = await this.dataSource.transaction(async (manager) => {
        const tenantRepository = manager.getRepository(Tenant);
        const userRepository = manager.getRepository(User);
        const roleRepository = manager.getRepository(Role);
        const companyRepository = manager.getRepository(CompanyDetails);
        const signupSessionRepository = manager.getRepository(SignupSession);

        const tenantToCreate = tenantRepository.create({
          name: tenantName,
        });
        const savedTenant = await tenantRepository.save(tenantToCreate);

        const role = await this.resolveTenantAdminRole(roleRepository);

        const { firstName, lastName } = this.splitName(adminName);
        const password = this.generateTemporaryPassword();
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create SignupSession for system tenant (similar to manual signup flow)
        const sessionToCreate = signupSessionRepository.create({
          email: normalizedAdminEmail,
          password_hash: hashedPassword,
          first_name: firstName,
          last_name: lastName,
          phone: "",
          status: "completed", // System tenants are already completed
        });
        const savedSession = await signupSessionRepository.save(sessionToCreate);

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
            logo_url: logoUrl,
            signup_session_id: savedSession.id, // Link to the signup session
          });
        } else {
          companyDetails.company_name = tenantName;
          companyDetails.domain = domain;
          companyDetails.logo_url = logoUrl;
          companyDetails.signup_session_id = savedSession.id; // Link to the signup session
        }

        const savedCompany = await companyRepository.save(companyDetails);

        return {
          tenant: savedTenant,
          admin: savedAdmin,
          temporaryPassword: password,
          company: savedCompany,
          signupSession: savedSession,
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
        signupSession: {
          id: signupSession.id,
          email: signupSession.email,
          status: signupSession.status,
          created_at: signupSession.created_at,
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
   * Get list of tenants with pagination
   */
  async findAll(page: number = 1, limit: number = 25, includeDeleted: boolean = false): Promise<PaginationResponse<Tenant>> {
    const skip = (page - 1) * limit;
    const where: FindOptionsWhere<Tenant> = includeDeleted
      ? {}
      : { isDeleted: false };

    const [items, total] = await this.tenantRepo.findAndCount({
      where,
      order: { created_at: "DESC" },
      skip,
      take: limit,
    });

    const totalPages = Math.ceil(total / limit);

    return {
      items,
      total,
      page,
      limit,
      totalPages,
    };
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
   * Get full tenant details with departments (including default/global departments), employee count
   */
  async getTenantDetails(id: string) {
    const tenant = await this.findOne(id, ["departments", "users"]);

    if (!tenant) {
      throw new NotFoundException("Tenant not found.");
    }

    const company = await this.companyDetailsRepo.findOne({
      where: { tenant_id: tenant.id },
    });

    // Get tenant's own departments
    const tenantDepartments = tenant.departments || [];
    
    // Get global default departments
    const globalDepartments = await this.departmentRepo.find({
      where: { tenant_id: this.GLOBAL_TENANT_ID },
      order: { name: "ASC" },
    });

    // Combine tenant departments and global departments
    // If a department with same name exists in both, prioritize tenant's department
    const tenantDeptNames = new Set(tenantDepartments.map(d => d.name.toLowerCase()));
    const allDepartments = [
      ...tenantDepartments,
      ...globalDepartments.filter(gd => !tenantDeptNames.has(gd.name.toLowerCase()))
    ];

    // Sort all departments by name
    allDepartments.sort((a, b) => a.name.localeCompare(b.name));

    const departmentCount = allDepartments.length;
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
      departments: allDepartments.map((d) => ({
        id: d.id,
        name: d.name,
        description: d.description,
        isDefault: d.tenant_id === this.GLOBAL_TENANT_ID, // Flag to indicate if it's a default department
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

  /**
   * Update tenant company details (name, logo, domain)
   */
  async update(dto: UpdateTenantDto, file?: Express.Multer.File) {
    const tenant = await this.findOne(dto.tenantId);

    if (!tenant) {
      throw new NotFoundException("Tenant not found.");
    }

    // Get or create company details
    let companyDetails = await this.companyDetailsRepo.findOne({
      where: { tenant_id: tenant.id },
    });

    // Handle file upload if provided
    let logoUrl: string | null = null;
    if (file) {
      // Save uploaded file to public/company-logos
      const uploadsDir = path.join(process.cwd(), 'public', 'company-logos');
      if (!fs.existsSync(uploadsDir)) {
        await fs.promises.mkdir(uploadsDir, { recursive: true });
      }

      // Delete old logo if it exists
      if (companyDetails?.logo_url) {
        const oldFileName = companyDetails.logo_url.split('/').pop()?.split('?')[0];
        if (oldFileName) {
          const oldFilePath = path.join(uploadsDir, oldFileName);
          try {
            if (fs.existsSync(oldFilePath)) {
              await fs.promises.unlink(oldFilePath);
              this.logger.log(`Deleted old logo: ${oldFileName}`);
            }
          } catch (err) {
            this.logger.error(`Failed to delete old logo: ${String((err as Error)?.message || err)}`);
          }
        }
      }

      const timestamp = Date.now();
      const randomNum = Math.floor(Math.random() * 1000000000);
      const fileExtension = path.extname(file.originalname);
      const fileName = `${timestamp}-${randomNum}${fileExtension}`;
      const filePath = path.join(uploadsDir, fileName);

      await fs.promises.writeFile(filePath, file.buffer);
      logoUrl = `/company-logos/${fileName}`;
      this.logger.log(`Logo file saved: ${fileName}`);
    } else if (dto.logo !== undefined) {
      // Use provided logo URL string if no file uploaded
      logoUrl = dto.logo?.trim() || null;
    } else if (companyDetails) {
      // Keep existing logo if neither file nor logo URL is provided
      logoUrl = companyDetails.logo_url;
    }

    // Update tenant name if provided
    if (dto.companyName) {
      const trimmedName = dto.companyName.trim();
      if (!trimmedName) {
        throw new BadRequestException("Company name cannot be empty");
      }

      // Check for duplicate name (case-insensitive, excluding current tenant)
      const existing = await this.tenantRepo.findOne({
        where: {
          name: ILike(trimmedName),
          isDeleted: false,
        },
      });

      if (existing && existing.id !== tenant.id) {
        throw new ConflictException(
          `Tenant with name '${trimmedName}' already exists.`,
        );
      }

      tenant.name = trimmedName;
    }

    // Update company details
    if (!companyDetails) {
      companyDetails = this.companyDetailsRepo.create({
        tenant_id: tenant.id,
        company_name: dto.companyName || tenant.name,
        domain: dto.domain?.trim().toLowerCase() || "",
        plan_id: this.defaultPlanId,
        is_paid: false,
        logo_url: logoUrl,
      });
    } else {
      if (dto.companyName) {
        companyDetails.company_name = dto.companyName.trim();
      }
      if (dto.domain) {
        const trimmedDomain = dto.domain.trim().toLowerCase();
        if (!trimmedDomain) {
          throw new BadRequestException("Domain cannot be empty");
        }

        // Check for duplicate domain (excluding current tenant)
        const existingCompany = await this.companyDetailsRepo.findOne({
          where: { domain: ILike(trimmedDomain) },
        });

        if (existingCompany && existingCompany.tenant_id !== tenant.id) {
          throw new ConflictException(
            `Company details already exist for domain '${dto.domain}'.`,
          );
        }

        companyDetails.domain = trimmedDomain;
      }
      if (logoUrl !== null) {
        companyDetails.logo_url = logoUrl;
      }
    }

    // Save both tenant and company details in a transaction
    const result = await this.dataSource.transaction(async (manager) => {
      const tenantRepository = manager.getRepository(Tenant);
      const companyRepository = manager.getRepository(CompanyDetails);

      const savedTenant = await tenantRepository.save(tenant);
      const savedCompany = await companyRepository.save(companyDetails);

      return {
        tenant: savedTenant,
        company: savedCompany,
      };
    });

    return {
      id: result.tenant.id,
      name: result.tenant.name,
      domain: result.company.domain,
      logo: result.company.logo_url,
      status: result.tenant.status,
      updated_at: result.tenant.updated_at,
      company: {
        id: result.company.id,
        company_name: result.company.company_name,
        domain: result.company.domain,
        logo_url: result.company.logo_url,
        is_paid: result.company.is_paid,
        plan_id: result.company.plan_id,
        tenant_id: result.company.tenant_id,
      },
    };
  }
}
