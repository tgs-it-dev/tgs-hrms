import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from './../../entities/company.entity';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { User, UserRole } from '../../entities/user.entity';

@Injectable()
export class CompanyService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async create(dto: CreateCompanyDto, currentUser: User): Promise<Company> {
    // Ensure only admins can create companies
    if (currentUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only administrators can create companies');
    }

    const exists = await this.companyRepo.findOne({ where: { name: dto.name } });
    if (exists) {
      throw new ConflictException('Company name already exists');
    }

    const company = this.companyRepo.create(dto);
    return this.companyRepo.save(company);
  }

  async findAll(): Promise<Company[]> {
    return this.companyRepo.find();
  }

  async findOne(id: string): Promise<Company> {
    const company = await this.companyRepo.findOne({ where: { id } });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  async update(id: string, dto: UpdateCompanyDto, currentUser: User): Promise<Company> {
    // Ensure only admins can update companies
    if (currentUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only administrators can update companies');
    }

    const company = await this.findOne(id);

    if (dto.name && dto.name !== company.name) {
      const nameExists = await this.companyRepo.findOne({ where: { name: dto.name } });
      if (nameExists) {
        throw new ConflictException('Company name already exists');
      }
    }

    Object.assign(company, dto);
    return this.companyRepo.save(company);
  }

  async remove(id: string, currentUser: User): Promise<void> {
    // Ensure only admins can delete companies
    if (currentUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only administrators can delete companies');
    }

    const company = await this.findOne(id);
    await this.companyRepo.remove(company);
  }
}
