import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Designation } from '../../../entities/designation.entity';
import { Team } from '../../../entities/team.entity';
import { User } from '../../../entities/user.entity';
import { Role } from '../../../entities/role.entity';
import { CreateEmployeeDto } from '../dto/employee.dto';
import { UserGender } from '../../../common/constants/enums';
import { EMPLOYEE_MESSAGES, EMPLOYEE_ROLE_NAMES } from '../../../common/constants/employee.constants';

/** Global tenant id used for shared / seeded designations. */
export const GLOBAL_TENANT_ID = '00000000-0000-0000-0000-000000000000';

@Injectable()
export class EmployeeValidationService {
  constructor(
    @InjectRepository(Designation)
    private readonly designationRepo: Repository<Designation>,
    @InjectRepository(Team)
    private readonly teamRepo: Repository<Team>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
  ) {}

  parseOptionalGender(value: string | undefined): UserGender | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    const allowed = Object.values(UserGender) as string[];
    return allowed.includes(value) ? (value as UserGender) : undefined;
  }

  async validateDesignation(designation_id: string, tenant_id: string): Promise<Designation> {
    const designation = await this.designationRepo.findOne({
      where: { id: designation_id },
      relations: ['department'],
    });

    if (!designation) {
      throw new BadRequestException(EMPLOYEE_MESSAGES.INVALID_DESIGNATION_ID);
    }

    if (designation.department.tenant_id !== tenant_id && designation.department.tenant_id !== GLOBAL_TENANT_ID) {
      throw new BadRequestException(EMPLOYEE_MESSAGES.DESIGNATION_NOT_IN_TENANT);
    }

    return designation;
  }

  validateUuid(value: string, fieldName: string): void {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      throw new BadRequestException(EMPLOYEE_MESSAGES.FIELD_MUST_BE_UUID(fieldName));
    }
  }

  async validateTeam(team_id: string, tenant_id: string): Promise<Team> {
    const team = await this.teamRepo.findOne({
      where: { id: team_id },
      relations: ['manager'],
    });

    if (!team) {
      throw new BadRequestException(EMPLOYEE_MESSAGES.INVALID_TEAM_ID);
    }

    if (team.manager.tenant_id !== tenant_id) {
      throw new BadRequestException(EMPLOYEE_MESSAGES.TEAM_NOT_IN_TENANT);
    }

    return team;
  }

  async resolveRoleForCreation(dto: CreateEmployeeDto, defaultRoleName: string): Promise<Role> {
    if (dto.role_name) {
      const role = await this.roleRepo.findOne({ where: { name: dto.role_name } });
      if (!role) {
        throw new NotFoundException(EMPLOYEE_MESSAGES.ROLE_NOT_FOUND_BY_NAME(dto.role_name));
      }
      return role;
    }
    if (dto.role_id) {
      const role = await this.roleRepo.findOne({ where: { id: dto.role_id } });
      if (!role) throw new NotFoundException(EMPLOYEE_MESSAGES.SPECIFIED_ROLE_NOT_FOUND);
      return role;
    }
    const role = await this.roleRepo.findOne({ where: { name: defaultRoleName } });
    if (!role) {
      throw new NotFoundException(
        defaultRoleName === EMPLOYEE_ROLE_NAMES.MANAGER
          ? EMPLOYEE_MESSAGES.MANAGER_ROLE_NOT_FOUND
          : EMPLOYEE_MESSAGES.EMPLOYEE_ROLE_NOT_FOUND,
      );
    }
    return role;
  }

  async assertCreateEmployeePreconditions(tenant_id: string, dto: CreateEmployeeDto): Promise<void> {
    await this.validateDesignation(dto.designation_id, tenant_id);

    if (dto.team_id && dto.team_id !== null) {
      this.validateUuid(dto.team_id, 'team_id');
      await this.validateTeam(dto.team_id, tenant_id);
    }

    if (dto.role_id && dto.role_id !== null) {
      this.validateUuid(dto.role_id, 'role_id');
    }

    const existingUser = await this.userRepo.findOne({
      where: { email: dto.email, tenant_id },
    });
    if (existingUser) {
      throw new ConflictException(EMPLOYEE_MESSAGES.EMAIL_ALREADY_IN_TENANT);
    }
  }
}
