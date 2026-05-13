import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Shift } from '../../entities/shift.entity';
import { Employee } from '../../entities/employee.entity';
import { TenantDatabaseService } from '../../common/services/tenant-database.service';
import { CreateShiftDto } from './dto/create-shift.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';

@Injectable()
export class ShiftService {
  constructor(
    @InjectRepository(Shift)
    private readonly shiftRepo: Repository<Shift>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    private readonly tenantDbService: TenantDatabaseService,
  ) {}

  async findAll(tenantId: string): Promise<Shift[]> {
    return this.shiftRepo.find({
      where: { tenant_id: tenantId },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string, tenantId: string): Promise<Shift> {
    const shift = await this.shiftRepo.findOne({ where: { id, tenant_id: tenantId } });
    if (!shift) throw new NotFoundException('Shift not found');
    return shift;
  }

  async create(tenantId: string, dto: CreateShiftDto): Promise<Shift> {
    const existing = await this.shiftRepo.findOne({
      where: { tenant_id: tenantId, name: dto.name },
    });
    if (existing) throw new ConflictException(`A shift named "${dto.name}" already exists`);

    const shift = this.shiftRepo.create({ ...dto, tenant_id: tenantId });
    return this.shiftRepo.save(shift);
  }

  async update(id: string, tenantId: string, dto: UpdateShiftDto): Promise<Shift> {
    const shift = await this.findOne(id, tenantId);
    Object.assign(shift, dto);
    return this.shiftRepo.save(shift);
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const shift = await this.findOne(id, tenantId);
    // Unassign from all employees before deleting
    await this.employeeRepo.update({ shift_id: id }, { shift_id: null });
    await this.shiftRepo.remove(shift);
  }

  async assignToEmployee(
    employeeId: string,
    tenantId: string,
    shiftId: string | null,
    isProvisioned: boolean,
  ): Promise<void> {
    if (shiftId) {
      await this.findOne(shiftId, tenantId);
    }

    const doUpdate = async (repo: Repository<Employee>) => {
      const employee = await repo.findOne({
        where: { id: employeeId, deleted_at: IsNull() },
      });
      if (!employee) throw new NotFoundException('Employee not found');
      employee.shift_id = shiftId ?? null;
      await repo.save(employee);
    };

    if (isProvisioned) {
      await this.tenantDbService.withTenantSchema(tenantId, (em) =>
        doUpdate(em.getRepository(Employee)),
      );
    } else {
      await doUpdate(this.employeeRepo);
    }
  }
}
