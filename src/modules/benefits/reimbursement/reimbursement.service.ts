import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BenefitReimbursementRequest } from '../../../entities/benefit-reimbursement-request.entity';
import { EmployeeBenefit } from '../../../entities/employee-benefit.entity';
import { Employee } from '../../../entities/employee.entity';
import { Tenant } from '../../../entities/tenant.entity';
import { BenefitReimbursementStatus } from '../../../common/constants/enums';
import { CreateReimbursementRequestDto } from '../dto/reimbursement/create-reimbursement-request.dto';
import { UpdateReimbursementRequestDto } from '../dto/reimbursement/update-reimbursement-request.dto';
import { ReviewReimbursementRequestDto } from '../dto/reimbursement/review-reimbursement-request.dto';
import { ReimbursementFileUploadService } from './reimbursement-file-upload.service';

@Injectable()
export class ReimbursementService {
  constructor(
    @InjectRepository(BenefitReimbursementRequest)
    private readonly reimbursementRepo: Repository<BenefitReimbursementRequest>,

    @InjectRepository(EmployeeBenefit)
    private readonly employeeBenefitRepo: Repository<EmployeeBenefit>,

    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,

    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,

    private readonly fileUploadService: ReimbursementFileUploadService,
  ) {}

  /**
   * Create a new reimbursement request
   */
  async create(
    tenant_id: string,
    userId: string,
    dto: CreateReimbursementRequestDto,
    files?: Express.Multer.File[],
  ): Promise<BenefitReimbursementRequest> {
    // Validate tenant
    const tenant = await this.tenantRepo.findOne({ where: { id: tenant_id } });
    if (!tenant) {
      throw new BadRequestException('Invalid tenant ID');
    }

    // Get employee by user_id
    const employee = await this.employeeRepo
      .createQueryBuilder('employee')
      .innerJoin('employee.user', 'user')
      .where('employee.user_id = :userId', { userId })
      .andWhere('user.tenant_id = :tenantId', { tenantId: tenant_id })
      .getOne();

    if (!employee) {
      throw new BadRequestException('Employee not found for this user');
    }

    const employeeId = employee.id;

    // Validate employee benefit assignment
    const employeeBenefit = await this.employeeBenefitRepo.findOne({
      where: {
        id: dto.employeeBenefitId,
        employeeId,
        tenant_id,
        status: 'active',
      },
      relations: ['benefit', 'employee'],
    });

    if (!employeeBenefit) {
      throw new NotFoundException(
        'Active benefit assignment not found for this employee',
      );
    }

    // Create reimbursement request first to get ID
    const reimbursementRequest = this.reimbursementRepo.create({
      employeeId,
      employeeBenefitId: dto.employeeBenefitId,
      amount: dto.amount,
      details: dto.details,
      proofDocuments: [],
      status: BenefitReimbursementStatus.PENDING,
      tenant_id,
    });

    const saved = await this.reimbursementRepo.save(reimbursementRequest);

    // Upload proof documents if provided (using actual request ID)
    let proofDocuments: string[] = [];
    if (files && files.length > 0) {
      proofDocuments = await this.fileUploadService.uploadReimbursementDocuments(
        files,
        saved.id,
      );
      saved.proofDocuments = proofDocuments;
      await this.reimbursementRepo.save(saved);
    }

    return this.findOne(tenant_id, saved.id, employeeId);
  }

  /**
   * Get employee by user ID
   */
  async getEmployeeByUserId(tenant_id: string, userId: string) {
    return await this.employeeRepo
      .createQueryBuilder('employee')
      .innerJoin('employee.user', 'user')
      .where('employee.user_id = :userId', { userId })
      .andWhere('user.tenant_id = :tenantId', { tenantId: tenant_id })
      .getOne();
  }

  /**
   * Find all reimbursement requests for an employee
   */
  async findAllByEmployee(
    tenant_id: string,
    employeeId: string,
    page: number = 1,
  ) {
    const skip = (page - 1) * 25;

    const [requests, total] = await this.reimbursementRepo.findAndCount({
      where: {
        employeeId,
        tenant_id,
      },
      relations: ['employeeBenefit', 'employeeBenefit.benefit', 'reviewer'],
      order: { createdAt: 'DESC' },
      skip,
      take: 25,
    });

    return {
      items: requests,
      total,
      page,
      totalPages: Math.ceil(total / 25),
    };
  }

  /**
   * Find all reimbursement requests (for HR/Admin)
   */
  async findAll(
    tenant_id: string,
    page: number = 1,
    status?: BenefitReimbursementStatus,
    employeeId?: string,
  ) {
    const skip = (page - 1) * 25;
    const where: any = { tenant_id };

    if (status) {
      where.status = status;
    }

    if (employeeId) {
      where.employeeId = employeeId;
    }

    const [requests, total] = await this.reimbursementRepo.findAndCount({
      where,
      relations: [
        'employee',
        'employee.user',
        'employeeBenefit',
        'employeeBenefit.benefit',
        'reviewer',
        'reviewer.user',
      ],
      order: { createdAt: 'DESC' },
      skip,
      take: 25,
    });

    return {
      items: requests,
      total,
      page,
      totalPages: Math.ceil(total / 25),
    };
  }

  /**
   * Find a single reimbursement request
   */
  async findOne(
    tenant_id: string,
    id: string,
    employeeId?: string,
  ): Promise<BenefitReimbursementRequest> {
    const where: any = { id, tenant_id };
    if (employeeId) {
      where.employeeId = employeeId;
    }

    const request = await this.reimbursementRepo.findOne({
      where,
      relations: [
        'employee',
        'employee.user',
        'employeeBenefit',
        'employeeBenefit.benefit',
        'reviewer',
        'reviewer.user',
      ],
    });

    if (!request) {
      throw new NotFoundException('Reimbursement request not found');
    }

    return request;
  }

  /**
   * Update a reimbursement request (only by the employee who created it, and only if pending)
   */
  async update(
    tenant_id: string,
    id: string,
    employeeId: string,
    dto: UpdateReimbursementRequestDto,
    files?: Express.Multer.File[],
    documentsToRemove?: string[],
  ): Promise<BenefitReimbursementRequest> {
    const request = await this.reimbursementRepo.findOne({
      where: { id, tenant_id, employeeId },
    });

    if (!request) {
      throw new NotFoundException('Reimbursement request not found');
    }

    if (request.status !== BenefitReimbursementStatus.PENDING) {
      throw new ForbiddenException(
        'Only pending reimbursement requests can be updated',
      );
    }

    // Update fields
    if (dto.amount !== undefined) {
      request.amount = dto.amount;
    }
    if (dto.details !== undefined) {
      request.details = dto.details;
    }

    // Handle document removal
    if (documentsToRemove && documentsToRemove.length > 0) {
      await this.fileUploadService.deleteReimbursementDocuments(
        documentsToRemove,
      );
      request.proofDocuments = request.proofDocuments.filter(
        (doc) => !documentsToRemove.includes(doc),
      );
    }

    // Handle new document uploads
    if (files && files.length > 0) {
      const newDocuments =
        await this.fileUploadService.uploadReimbursementDocuments(
          files,
          request.id,
        );
      request.proofDocuments = [
        ...request.proofDocuments,
        ...newDocuments,
      ];
    }

    await this.reimbursementRepo.save(request);
    return this.findOne(tenant_id, id, employeeId);
  }

  /**
   * Cancel a reimbursement request (only by the employee who created it)
   */
  async cancel(
    tenant_id: string,
    id: string,
    employeeId: string,
  ): Promise<BenefitReimbursementRequest> {
    const request = await this.reimbursementRepo.findOne({
      where: { id, tenant_id, employeeId },
    });

    if (!request) {
      throw new NotFoundException('Reimbursement request not found');
    }

    if (request.status !== BenefitReimbursementStatus.PENDING) {
      throw new ConflictException(
        'Only pending reimbursement requests can be cancelled',
      );
    }

    request.status = BenefitReimbursementStatus.CANCELLED;
    await this.reimbursementRepo.save(request);

    return this.findOne(tenant_id, id, employeeId);
  }

  /**
   * Review (approve/reject) a reimbursement request (HR/Admin only)
   */
  async review(
    tenant_id: string,
    id: string,
    reviewerId: string,
    dto: ReviewReimbursementRequestDto,
  ): Promise<BenefitReimbursementRequest> {
    const request = await this.reimbursementRepo.findOne({
      where: { id, tenant_id },
    });

    if (!request) {
      throw new NotFoundException('Reimbursement request not found');
    }

    if (request.status !== BenefitReimbursementStatus.PENDING) {
      throw new ConflictException('Request has already been processed');
    }

    // Validate reviewer is an employee in the tenant
    const reviewer = await this.employeeRepo
      .createQueryBuilder('employee')
      .innerJoin('employee.user', 'user')
      .where('employee.id = :reviewerId', { reviewerId })
      .andWhere('user.tenant_id = :tenantId', { tenantId: tenant_id })
      .getOne();

    if (!reviewer) {
      throw new BadRequestException('Invalid reviewer');
    }

    request.status =
      dto.status === 'approved'
        ? BenefitReimbursementStatus.APPROVED
        : BenefitReimbursementStatus.REJECTED;
    request.reviewedBy = reviewerId;
    request.reviewedAt = new Date();
    request.reviewRemarks = dto.reviewRemarks || null;

    await this.reimbursementRepo.save(request);
    return this.findOne(tenant_id, id);
  }
}
