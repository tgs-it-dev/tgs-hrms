import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompanyDetails } from '../../entities/company-details.entity';
import { Tenant } from '../../entities/tenant.entity';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CompanyResponseDto } from './dto/company-response.dto';
import * as fs from 'fs';
import * as path from 'path';

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

    if (!company) {
      throw new NotFoundException('Company details not found');
    }

    if (!company.tenant_id) {
      throw new NotFoundException('Company is not associated with any tenant');
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
    this.logger.log(`Updating company details for tenant: ${tenantId}, role: ${userRole}`);
    
    // Check if user is admin or system-admin
    if (userRole !== 'admin' && userRole !== 'system-admin') {
      throw new ForbiddenException('Only admin users can update company details');
    }

    const company = await this.companyDetailsRepo.findOne({
      where: { tenant_id: tenantId },
    });

    if (!company) {
      throw new NotFoundException('Company details not found');
    }

    // Update company details
    company.company_name = updateDto.company_name;
    company.domain = updateDto.domain;
    
    if (updateDto.logo_url !== undefined) {
      company.logo_url = updateDto.logo_url;
    }

    const updatedCompany = await this.companyDetailsRepo.save(company);
    
    // Also update tenant name to match company name
    if (company.tenant_id && updateDto.company_name) {
      await this.tenantRepo.update(
        { id: company.tenant_id },
        { name: updateDto.company_name }
      );
      this.logger.log(`Tenant name updated to: ${updateDto.company_name}`);
    }
    
    this.logger.log(`Company details updated successfully for tenant: ${tenantId}`);

    if (!updatedCompany.tenant_id) {
      throw new NotFoundException('Company is not associated with any tenant');
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
    this.logger.log(`Updating company logo for tenant: ${tenantId}, role: ${userRole}`);
    
    // Check if user is admin or system-admin
    if (userRole !== 'admin' && userRole !== 'system-admin') {
      throw new ForbiddenException('Only admin users can update company logo');
    }

    const company = await this.companyDetailsRepo.findOne({
      where: { tenant_id: tenantId },
    });

    if (!company) {
      throw new NotFoundException('Company details not found');
    }

    // Ensure the uploads directory exists
    const uploadsDir = path.join(process.cwd(), 'public', 'company-logos');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomNum = Math.floor(Math.random() * 1000000000);
    const fileExtension = path.extname(file.originalname);
    const fileName = `${timestamp}-${randomNum}${fileExtension}`;
    const filePath = path.join(uploadsDir, fileName);

    // Save file
    fs.writeFileSync(filePath, file.buffer);

    // Delete old logo if exists
    if (company.logo_url) {
      const oldFileName = company.logo_url.split('/').pop();
      if (oldFileName) {
        const oldFilePath = path.join(uploadsDir, oldFileName);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
          this.logger.log(`Deleted old logo: ${oldFileName}`);
        }
      }
    }

    // Update company logo URL
    const logoUrl = `/public/company-logos/${fileName}`;
    company.logo_url = logoUrl;

    const updatedCompany = await this.companyDetailsRepo.save(company);
    
    this.logger.log(`Company logo updated successfully for tenant: ${tenantId}`);

    if (!updatedCompany.tenant_id) {
      throw new NotFoundException('Company is not associated with any tenant');
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
}
