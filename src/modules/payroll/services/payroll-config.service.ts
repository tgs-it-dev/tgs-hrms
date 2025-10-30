import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PayrollConfig } from '../../../entities/payroll-config.entity';
import { Tenant } from '../../../entities/tenant.entity';
import { CreatePayrollConfigDto, UpdatePayrollConfigDto } from '../dto/payroll-config.dto';

@Injectable()
export class PayrollConfigService {
  constructor(
    @InjectRepository(PayrollConfig)
    private readonly payrollConfigRepo: Repository<PayrollConfig>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
  ) {}

  async create(tenantId: string, userId: string, dto: CreatePayrollConfigDto): Promise<PayrollConfig> {
    // Check if tenant exists
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Check if config already exists
    const existingConfig = await this.payrollConfigRepo.findOne({
      where: { tenant_id: tenantId },
    });

    if (existingConfig) {
      throw new BadRequestException('Payroll configuration already exists for this tenant. Use update endpoint instead.');
    }

    const config = this.payrollConfigRepo.create({
      tenant_id: tenantId,
      salaryCycle: dto.salaryCycle,
      basePayComponents: dto.basePayComponents || null,
      allowances: dto.allowances || null,
      deductions: dto.deductions || null,
      overtimePolicy: dto.overtimePolicy || null,
      leaveDeductionPolicy: dto.leaveDeductionPolicy || null,
      created_by: userId,
    });

    return await this.payrollConfigRepo.save(config);
  }

  async getByTenantId(tenantId: string): Promise<PayrollConfig> {
    const config = await this.payrollConfigRepo.findOne({
      where: { tenant_id: tenantId },
      relations: ['tenant'],
    });

    if (!config) {
      throw new NotFoundException('Payroll configuration not found for this tenant');
    }

    return config;
  }

  async update(tenantId: string, userId: string, dto: UpdatePayrollConfigDto): Promise<PayrollConfig> {
    const config = await this.payrollConfigRepo.findOne({
      where: { tenant_id: tenantId },
    });

    if (!config) {
      throw new NotFoundException('Payroll configuration not found for this tenant');
    }

    // Update only provided fields
    if (dto.salaryCycle !== undefined) config.salaryCycle = dto.salaryCycle;
    if (dto.basePayComponents !== undefined) config.basePayComponents = dto.basePayComponents;
    if (dto.allowances !== undefined) config.allowances = dto.allowances;
    if (dto.deductions !== undefined) config.deductions = dto.deductions;
    if (dto.overtimePolicy !== undefined) config.overtimePolicy = dto.overtimePolicy;
    if (dto.leaveDeductionPolicy !== undefined) config.leaveDeductionPolicy = dto.leaveDeductionPolicy;

    config.updated_by = userId;

    return await this.payrollConfigRepo.save(config);
  }

  async getDefaultConfig(): Promise<Partial<PayrollConfig>> {
    return {
      salaryCycle: 'monthly',
      basePayComponents: {
        basic: 0,
      },
      allowances: [],
      deductions: {
        taxPercentage: 0,
        insurancePercentage: 0,
        providentFundPercentage: 0,
      },
      overtimePolicy: {
        enabled: false,
        rateMultiplier: 1.5,
        maxHoursPerMonth: 40,
      },
      leaveDeductionPolicy: {
        unpaidLeaveDeduction: true,
        halfDayDeduction: 50,
      },
    };
  }
}

