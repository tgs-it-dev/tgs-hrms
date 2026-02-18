import {
  ConflictException,
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompanyDetails } from '../../entities/company-details.entity';
import { Tenant } from '../../entities/tenant.entity';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CompanyResponseDto } from './dto/company-response.dto';
import * as fs from 'fs';
import * as path from 'path';
import { createReadStream, statSync, existsSync } from 'fs';
import { validateImageFile } from '../../common/utils/file-validation.util';

@Injectable()
export class CompanyService {
  private readonly logger = new Logger(CompanyService.name);

  constructor(
    @InjectRepository(CompanyDetails)
    private readonly companyDetailsRepo: Repository<CompanyDetails>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
  ) {}

  async getCompanyDetails(tenantId: string): Promise<CompanyResponseDto> {
    this.logger.log(`Getting company details for tenant: ${tenantId}`);

    const company = await this.companyDetailsRepo.findOne({
      where: { tenant_id: tenantId },
    });
    this.logger.log(`Fetched logo_url from DB for tenant ${tenantId}: ${company?.logo_url}`);

    if (!company) {
      throw new NotFoundException('Company details not found');
    }

    if (!company.tenant_id) {
      throw new NotFoundException(
        'Company is not associated with any tenant',
      );
    }

    return {
      id: company.id,
      company_name: company.company_name,
      domain: company.domain,
      logo_url: company.logo_url,
      plan_id: company.plan_id,
      is_paid: company.is_paid,
      tenant_id: company.tenant_id,
      created_at: company.created_at,
      updated_at: company.updated_at,
    };
  }

  async updateCompanyDetails(
    tenantId: string,
    userRole: string,
    updateDto: UpdateCompanyDto,
  ): Promise<CompanyResponseDto> {
    this.logger.log(
      `Updating company details for tenant: ${tenantId}, role: ${userRole}`,
    );

    if (userRole !== 'admin' && userRole !== 'system-admin') {
      throw new ForbiddenException(
        'Only admin users can update company details',
      );
    }

    const company = await this.companyDetailsRepo.findOne({
      where: { tenant_id: tenantId },
    });

    if (!company) {
      throw new NotFoundException('Company details not found');
    }

    if (updateDto.domain !== undefined) {
      const domainNormalized = (updateDto.domain || '').trim().toLowerCase();
      if (!domainNormalized) {
        throw new BadRequestException('Domain cannot be empty');
      }
      const existingByDomain = await this.companyDetailsRepo
        .createQueryBuilder('cd')
        .where('LOWER(cd.domain) = :domain', { domain: domainNormalized })
        .andWhere('cd.id != :id', { id: company.id })
        .getOne();
      if (existingByDomain) {
        throw new ConflictException('Domain already exists.');
      }
      company.domain = domainNormalized;
    }
    if (updateDto.company_name !== undefined) {
      company.company_name = updateDto.company_name;
    }

    if (updateDto.logo_url !== undefined) {
      company.logo_url = updateDto.logo_url;
    }

    const updatedCompany = await this.companyDetailsRepo.save(company);

    if (company.tenant_id && updateDto.company_name) {
      await this.tenantRepo.update(
        { id: company.tenant_id },
        { name: updateDto.company_name },
      );
      this.logger.log(`Tenant name updated to: ${updateDto.company_name}`);
    }

    if (!updatedCompany.tenant_id) {
      throw new NotFoundException(
        'Company is not associated with any tenant',
      );
    }

    return {
      id: updatedCompany.id,
      company_name: updatedCompany.company_name,
      domain: updatedCompany.domain,
      logo_url: updatedCompany.logo_url,
      plan_id: updatedCompany.plan_id,
      is_paid: updatedCompany.is_paid,
      tenant_id: updatedCompany.tenant_id,
      created_at: updatedCompany.created_at,
      updated_at: updatedCompany.updated_at,
    };
  }

  async updateCompanyLogo(
    tenantId: string,
    userRole: string,
    file: Express.Multer.File,
  ): Promise<CompanyResponseDto> {
    this.logger.log(
      `Updating company logo for tenant: ${tenantId}, role: ${userRole}`,
    );

    if (file) {
      validateImageFile(file);
    }

    if (userRole !== 'admin' && userRole !== 'system-admin') {
      throw new ForbiddenException(
        'Only admin users can update company logo',
      );
    }

    const company = await this.companyDetailsRepo.findOne({
      where: { tenant_id: tenantId },
    });

    if (!company) {
      throw new NotFoundException('Company details not found');
    }

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

  
    if (company.logo_url) {
      const oldFileName = company.logo_url.split('/').pop()?.split('?')[0];
      if (oldFileName) {
        const oldFilePath = path.join(uploadsDir, oldFileName);
        try {
          if (fs.existsSync(oldFilePath)) {
            await fs.promises.unlink(oldFilePath);
            this.logger.log(`Deleted old logo: ${oldFileName}`);
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          this.logger.error(`Failed to delete old logo: ${errorMessage}`);
        }
      }
    }

  
    const logoUrl = `/company-logos/${fileName}?v=${Date.now()}`;
    company.logo_url = logoUrl;

    const updatedCompany = await this.companyDetailsRepo.save(company);

    if (!updatedCompany.tenant_id) {
      throw new NotFoundException(
        'Company is not associated with any tenant',
      );
    }

    this.logger.log(
      `Company logo updated successfully for tenant: ${tenantId}`,
    );

    return {
      id: updatedCompany.id,
      company_name: updatedCompany.company_name,
      domain: updatedCompany.domain,
      logo_url: updatedCompany.logo_url,
      plan_id: updatedCompany.plan_id,
      is_paid: updatedCompany.is_paid,
      tenant_id: updatedCompany.tenant_id,
      created_at: updatedCompany.created_at,
      updated_at: updatedCompany.updated_at,
    };
  }

  async getCompanyLogoStream(
    tenantId: string,
  ): Promise<{
    fileStream: fs.ReadStream | null;
    contentType: string;
    fileSize: number;
  }> {
    this.logger.log(`Fetching company logo stream for tenant: ${tenantId}`);

    const company = await this.companyDetailsRepo.findOne({
      where: { tenant_id: tenantId },
    });

    if (!company || !company.logo_url) {
      return { fileStream: null, contentType: 'image/jpeg', fileSize: 0 };
    }

    const uploadsDir = path.join(process.cwd(), 'public', 'company-logos');
    const fileName = company.logo_url.split('/').pop()?.split('?')[0]; 
    if (!fileName) {
      return { fileStream: null, contentType: 'image/jpeg', fileSize: 0 };
    }

    const filePath = path.join(uploadsDir, fileName);
    if (!existsSync(filePath)) {
      return { fileStream: null, contentType: 'image/jpeg', fileSize: 0 };
    }

    const stats = statSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    let contentType = 'image/jpeg';

    switch (ext) {
      case '.png':
        contentType = 'image/png';
        break;
      case '.gif':
        contentType = 'image/gif';
        break;
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg';
        break;
      case '.webp':
        contentType = 'image/webp';
        break;
    }

    const fileStream = createReadStream(filePath);
    return { fileStream, contentType, fileSize: stats.size };
  }
}
