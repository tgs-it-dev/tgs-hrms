import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  Not,
  DataSource,
  IsNull,
  EntityManager,
  In,
} from 'typeorm';
import { Team } from '../../entities/team.entity';
import { Employee } from '../../entities/employee.entity';
import { User } from '../../entities/user.entity';
import { Tenant } from '../../entities/tenant.entity';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { EmployeeStatus } from '../../common/constants/enums';
import { TenantDatabaseService } from '../../common/services/tenant-database.service';
import { SendGridService } from '../../common/utils/email/sendgrid.service';

@Injectable()
export class TeamService {
  private readonly logger = new Logger(TeamService.name);

  constructor(
    @InjectRepository(Team)
    private readonly teamRepo: Repository<Team>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly dataSource: DataSource,
    private readonly tenantDbService: TenantDatabaseService,
    private readonly sendGridService: SendGridService,
  ) {}

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async isTenantSchemaProvisioned(tenantId: string): Promise<boolean> {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    return tenant?.schema_provisioned ?? false;
  }

  private teamRepo$(em: EntityManager | null): Repository<Team> {
    return em ? em.getRepository(Team) : this.teamRepo;
  }

  private employeeRepo$(em: EntityManager | null): Repository<Employee> {
    return em ? em.getRepository(Employee) : this.employeeRepo;
  }

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  async create(tenantId: string, dto: CreateTeamDto): Promise<Team> {
    const isProvisioned = await this.isTenantSchemaProvisioned(tenantId);

    const manager = await this.userRepo.findOne({
      where: { id: dto.manager_id, tenant_id: tenantId },
      relations: ['role'],
    });
    if (!manager) {
      throw new NotFoundException('Manager not found in this tenant');
    }
    if (manager.role.name !== 'Manager') {
      throw new BadRequestException(
        'User must have manager role to create a team',
      );
    }

    const createWork = async (em: EntityManager | null) => {
      const teamR = this.teamRepo$(em);
      const employeeR = this.employeeRepo$(em);

      const existingTeam = await teamR.findOne({
        where: { manager_id: dto.manager_id },
      });
      if (existingTeam) {
        throw new BadRequestException(
          'Manager is already managing another team',
        );
      }

      const team = teamR.create({ ...dto });
      const savedTeam = await teamR.save(team);

      const managerEmployee = await employeeR.findOne({
        where: { user_id: dto.manager_id },
      });
      if (managerEmployee) {
        managerEmployee.team_id = savedTeam.id;
        await employeeR.save(managerEmployee);
      }
      return savedTeam;
    };

    if (isProvisioned) {
      return this.tenantDbService.withTenantSchema(tenantId, (em) =>
        createWork(em),
      );
    }
    return this.dataSource.transaction((em) => createWork(em));
  }

  async findAll(
    tenantId: string,
    page: number = 1,
  ): Promise<{
    items: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const isProvisioned = await this.isTenantSchemaProvisioned(tenantId);
    const limit = 25;
    const skip = (page - 1) * limit;

    const query = async (
      teamR: Repository<Team>,
      employeeR: Repository<Employee>,
    ) => {
      const [teams, total] = await teamR.findAndCount({
        where: { manager: { tenant_id: tenantId } },
        relations: [
          'manager',
          'manager.role',
          'teamMembers',
          'teamMembers.user',
          'teamMembers.designation',
          'teamMembers.designation.department',
        ],
        order: { created_at: 'DESC' },
        skip,
        take: limit,
      });

      const items = (teams || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        manager: t.manager
          ? {
              id: t.manager.id,
              name: `${t.manager.first_name} ${t.manager.last_name}`,
              first_name: t.manager.first_name,
              last_name: t.manager.last_name,
              email: t.manager.email,
              profile_pic: t.manager.profile_pic,
              role: t.manager.role ? t.manager.role.name : undefined,
            }
          : undefined,
        created_at: t.created_at,
        members: (t.teamMembers || []).map((m: any) => ({
          id: m.id,
          status: m.status,
          user: m.user
            ? {
                id: m.user.id,
                name: `${m.user.first_name} ${m.user.last_name}`,
                email: m.user.email,
                profile_pic: m.user.profile_pic,
              }
            : undefined,
          designation: m.designation
            ? { id: m.designation.id, title: m.designation.title }
            : undefined,
          department:
            m.designation && m.designation.department
              ? {
                  id: m.designation.department.id,
                  name: m.designation.department.name,
                }
              : undefined,
        })),
      }));

      const unassignedEmployees = await employeeR.find({
        where: {
          team_id: IsNull(),
          deleted_at: IsNull(),
          user: { tenant_id: tenantId },
          status: EmployeeStatus.ACTIVE,
        },
        relations: ['user', 'designation', 'designation.department'],
        order: { created_at: 'DESC' },
      });

      const employeePool = unassignedEmployees.map((m) => ({
        id: m.id,
        status: m.status,
        user: m.user
          ? {
              id: m.user.id,
              name: `${m.user.first_name} ${m.user.last_name}`,
              first_name: m.user.first_name,
              last_name: m.user.last_name,
              email: m.user.email,
              profile_pic: m.user.profile_pic,
            }
          : undefined,
        designation: m.designation
          ? { id: m.designation.id, title: m.designation.title }
          : undefined,
        department:
          m.designation && m.designation.department
            ? {
                id: m.designation.department.id,
                name: m.designation.department.name,
              }
            : undefined,
      }));

      return {
        items: [
          ...items,
          {
            id: 'employee-pool',
            name: 'Employee Pool',
            description: 'Unassigned employees',
            manager: undefined,
            created_at: undefined,
            members: employeePool,
          },
        ],
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    };

    if (isProvisioned) {
      return this.tenantDbService.withTenantSchemaReadOnly(tenantId, (em) =>
        query(em.getRepository(Team), em.getRepository(Employee)),
      );
    }
    return query(this.teamRepo, this.employeeRepo);
  }

  async findOne(tenantId: string, id: string): Promise<Team> {
    const isProvisioned = await this.isTenantSchemaProvisioned(tenantId);

    const doFind = async (teamR: Repository<Team>) => {
      const team = await teamR.findOne({
        where: { id, manager: { tenant_id: tenantId } },
        relations: [
          'manager',
          'manager.role',
          'teamMembers',
          'teamMembers.user',
          'teamMembers.designation',
        ],
      });
      if (!team) {
        throw new NotFoundException('Team not found');
      }
      return team;
    };

    if (isProvisioned) {
      return this.tenantDbService.withTenantSchemaReadOnly(tenantId, (em) =>
        doFind(em.getRepository(Team)),
      );
    }
    return doFind(this.teamRepo);
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateTeamDto,
  ): Promise<Team> {
    const isProvisioned = await this.isTenantSchemaProvisioned(tenantId);

    const updateWork = async (em: EntityManager | null) => {
      const teamR = this.teamRepo$(em);
      const userR = em ? em.getRepository(User) : this.userRepo;

      const team = await teamR.findOne({
        where: { id, manager: { tenant_id: tenantId } },
        relations: ['manager', 'manager.role'],
      });
      if (!team) {
        throw new NotFoundException('Team not found');
      }

      if (dto.manager_id && dto.manager_id !== team.manager_id) {
        const newManager = await userR.findOne({
          where: { id: dto.manager_id, tenant_id: tenantId },
          relations: ['role'],
        });
        if (!newManager) {
          throw new NotFoundException('New manager not found in this tenant');
        }
        if (newManager.role.name !== 'Manager') {
          throw new BadRequestException(
            'User must have manager role to manage a team',
          );
        }
        const existingTeam = await teamR.findOne({
          where: { manager_id: dto.manager_id, id: Not(id) },
        });
        if (existingTeam) {
          throw new BadRequestException(
            'New manager is already managing another team',
          );
        }
      }

      const updateData: Partial<Team> = {};
      if (dto.name !== undefined) updateData.name = dto.name;
      if (dto.description !== undefined)
        updateData.description = dto.description;
      if (dto.manager_id !== undefined) updateData.manager_id = dto.manager_id;

      await teamR.update(id, updateData);

      const updatedTeam = await teamR.findOne({
        where: { id, manager: { tenant_id: tenantId } },
        relations: [
          'manager',
          'manager.role',
          'teamMembers',
          'teamMembers.user',
          'teamMembers.designation',
        ],
      });
      if (!updatedTeam) {
        throw new NotFoundException('Team not found after update');
      }
      return updatedTeam;
    };

    if (isProvisioned) {
      return this.tenantDbService.withTenantSchema(tenantId, (em) =>
        updateWork(em),
      );
    }
    return this.dataSource.transaction((em) => updateWork(em));
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const isProvisioned = await this.isTenantSchemaProvisioned(tenantId);

    if (isProvisioned) {
      await this.tenantDbService.withTenantSchema(tenantId, async (em) => {
        const teamR = em.getRepository(Team);
        const team = await teamR.findOne({
          where: { id, manager: { tenant_id: tenantId } },
          relations: [
            'manager',
            'manager.role',
            'teamMembers',
            'teamMembers.user',
            'teamMembers.designation',
          ],
        });
        if (!team) throw new NotFoundException('Team not found');
        await em
          .getRepository(Employee)
          .update({ team_id: id }, { team_id: null });
        await teamR.remove(team);
      });
    } else {
      const team = await this.findOne(tenantId, id);
      await this.employeeRepo.update({ team_id: id }, { team_id: null });
      await this.teamRepo.remove(team);
    }
  }

  async getAllTeamMembers(
    tenantId: string,
    page: number = 1,
  ): Promise<{
    items: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const isProvisioned = await this.isTenantSchemaProvisioned(tenantId);
    const limit = 25;
    const skip = (page - 1) * limit;

    const doQuery = async (employeeR: Repository<Employee>) => {
      const qb = employeeR
        .createQueryBuilder('e')
        .leftJoinAndSelect('e.user', 'u')
        .leftJoinAndSelect('e.designation', 'd')
        .leftJoinAndSelect('d.department', 'dep')
        .leftJoinAndSelect('e.team', 't')
        .where('u.tenant_id = :tenantId', { tenantId })
        .andWhere('e.team_id IS NOT NULL')
        .orderBy('e.created_at', 'DESC')
        .skip(skip)
        .take(limit);

      const [items, total] = await qb.getManyAndCount();
      return {
        items: items.map((employee) => ({
          id: employee.id,
          user: {
            id: employee.user.id,
            first_name: employee.user.first_name,
            last_name: employee.user.last_name,
            email: employee.user.email,
            profile_pic: employee.user.profile_pic,
          },
          designation: {
            id: employee.designation.id,
            title: employee.designation.title,
          },
          department: {
            id: employee.designation.department.id,
            name: employee.designation.department.name,
          },
          team: { id: employee.team.id, name: employee.team.name },
        })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    };

    if (isProvisioned) {
      return this.tenantDbService.withTenantSchemaReadOnly(tenantId, (em) =>
        doQuery(em.getRepository(Employee)),
      );
    }
    return doQuery(this.employeeRepo);
  }

  async getTeamMembers(
    tenantId: string,
    teamId: string,
    page: number = 1,
  ): Promise<{
    items: Employee[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const isProvisioned = await this.isTenantSchemaProvisioned(tenantId);
    const limit = 25;
    const skip = (page - 1) * limit;

    const doQuery = async (employeeR: Repository<Employee>) => {
      const [items, total] = await employeeR.findAndCount({
        where: {
          team_id: teamId,
          deleted_at: IsNull(),
          user: { tenant_id: tenantId },
        },
        relations: ['user', 'designation', 'designation.department'],
        order: { created_at: 'ASC' },
        skip,
        take: limit,
      });
      return {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    };

    if (isProvisioned) {
      return this.tenantDbService.withTenantSchemaReadOnly(tenantId, (em) =>
        doQuery(em.getRepository(Employee)),
      );
    }
    return doQuery(this.employeeRepo);
  }

  async getManagerTeams(managerId: string, tenantId: string): Promise<Team[]> {
    const isProvisioned = await this.isTenantSchemaProvisioned(tenantId);

    const doQuery = async (teamR: Repository<Team>) =>
      teamR.find({
        where: { manager_id: managerId, manager: { tenant_id: tenantId } },
        relations: [
          'teamMembers',
          'teamMembers.user',
          'teamMembers.designation',
        ],
      });

    if (isProvisioned) {
      return this.tenantDbService.withTenantSchemaReadOnly(tenantId, (em) =>
        doQuery(em.getRepository(Team)),
      );
    }
    return doQuery(this.teamRepo);
  }

  async addMemberToTeam(
    tenantId: string,
    teamId: string,
    employeeId: string,
  ): Promise<void> {
    const isProvisioned = await this.isTenantSchemaProvisioned(tenantId);

    const doWork = async (
      teamR: Repository<Team>,
      employeeR: Repository<Employee>,
    ) => {
      const team = await teamR.findOne({
        where: { id: teamId, manager: { tenant_id: tenantId } },
        relations: [
          'manager',
          'manager.role',
          'teamMembers',
          'teamMembers.user',
          'teamMembers.designation',
        ],
      });
      if (!team) throw new NotFoundException('Team not found');

      const employee = await employeeR.findOne({
        where: {
          id: employeeId,
          deleted_at: IsNull(),
          user: { tenant_id: tenantId },
        },
      });
      if (!employee)
        throw new NotFoundException('Employee not found in this tenant');
      if (employee.team_id)
        throw new BadRequestException('Employee is already part of a team');

      employee.team_id = teamId;
      await employeeR.save(employee);

      // Send team member announcement emails
      await this.sendNewTeamMemberAnnouncementToTeam(
        tenantId,
        teamId,
        employeeId,
        isProvisioned,
      );
    };

    if (isProvisioned) {
      await this.tenantDbService.withTenantSchema(tenantId, (em) =>
        doWork(em.getRepository(Team), em.getRepository(Employee)),
      );
    } else {
      await doWork(this.teamRepo, this.employeeRepo);
    }
  }

  async removeMemberFromTeam(
    tenantId: string,
    teamId: string,
    employeeId: string,
  ): Promise<void> {
    const isProvisioned = await this.isTenantSchemaProvisioned(tenantId);

    const doWork = async (employeeR: Repository<Employee>) => {
      const employee = await employeeR.findOne({
        where: {
          id: employeeId,
          team_id: teamId,
          deleted_at: IsNull(),
          user: { tenant_id: tenantId },
        },
      });
      if (!employee)
        throw new NotFoundException('Employee not found in this team');
      employee.team_id = null;
      await employeeR.save(employee);
    };

    if (isProvisioned) {
      await this.tenantDbService.withTenantSchema(tenantId, (em) =>
        doWork(em.getRepository(Employee)),
      );
    } else {
      await doWork(this.employeeRepo);
    }
  }

  async getAvailableEmployees(
    tenantId: string,
    managerId: string,
    page = 1,
    search?: string,
  ): Promise<{
    items: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const isProvisioned = await this.isTenantSchemaProvisioned(tenantId);
    const limit = 25;
    const skip = (page - 1) * limit;

    const doQuery = async (employeeR: Repository<Employee>) => {
      const manager = await employeeR.findOne({
        where: { user_id: managerId },
        relations: ['designation', 'designation.department'],
      });
      if (!manager?.designation?.department) {
        throw new BadRequestException('Manager must belong to a department');
      }

      const qb = employeeR
        .createQueryBuilder('e')
        .leftJoinAndSelect('e.user', 'u')
        .leftJoinAndSelect('e.designation', 'd')
        .leftJoinAndSelect('d.department', 'dep')
        .where('u.tenant_id = :tenantId', { tenantId })
        .andWhere('e.deleted_at IS NULL')
        .andWhere('dep.id = :deptId', {
          deptId: manager.designation.department.id,
        })
        .andWhere('e.team_id IS NULL')
        .andWhere('e.user_id != :managerId', { managerId });

      if (search) {
        qb.andWhere(
          '(u.first_name ILIKE :search OR u.last_name ILIKE :search)',
          { search: `%${search}%` },
        );
      }

      const [items, total] = await qb
        .orderBy('u.first_name', 'ASC')
        .skip(skip)
        .take(limit)
        .getManyAndCount();

      return {
        items: items.map((employee) => ({
          id: employee.id,
          user: {
            id: employee.user.id,
            first_name: employee.user.first_name,
            last_name: employee.user.last_name,
            email: employee.user.email,
            profile_pic: employee.user.profile_pic,
          },
          designation: {
            id: employee.designation.id,
            title: employee.designation.title,
          },
          department: {
            id: employee.designation.department.id,
            name: employee.designation.department.name,
          },
        })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    };

    if (isProvisioned) {
      return this.tenantDbService.withTenantSchemaReadOnly(tenantId, (em) =>
        doQuery(em.getRepository(Employee)),
      );
    }
    return doQuery(this.employeeRepo);
  }

  async getAllMembersForManager(
    tenantId: string,
    managerId: string,
    page = 1,
  ): Promise<{
    items: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const isProvisioned = await this.isTenantSchemaProvisioned(tenantId);
    const limit = 25;
    const skip = (page - 1) * limit;

    const doQuery = async (employeeR: Repository<Employee>) => {
      const qb = employeeR
        .createQueryBuilder('e')
        .leftJoinAndSelect('e.user', 'u')
        .leftJoinAndSelect('e.designation', 'd')
        .leftJoinAndSelect('d.department', 'dep')
        .leftJoin('e.team', 't')
        .where('u.tenant_id = :tenantId', { tenantId })
        .andWhere('t.manager_id = :managerId', { managerId })
        .andWhere('e.user_id != :managerId', { managerId });

      const [items, total] = await qb
        .orderBy('e.created_at', 'DESC')
        .skip(skip)
        .take(limit)
        .getManyAndCount();

      return {
        items: items.map((employee) => ({
          id: employee.id,
          employeeId: employee.id,
          user: {
            id: employee.user.id,
            first_name: employee.user.first_name,
            last_name: employee.user.last_name,
            email: employee.user.email,
            profile_pic: employee.user.profile_pic,
          },
          designation: {
            id: employee.designation.id,
            title: employee.designation.title,
          },
          department: {
            id: employee.designation.department.id,
            name: employee.designation.department.name,
          },
        })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    };

    if (isProvisioned) {
      return this.tenantDbService.withTenantSchemaReadOnly(tenantId, (em) =>
        doQuery(em.getRepository(Employee)),
      );
    }
    return doQuery(this.employeeRepo);
  }

  async getAvailableManagers(tenantId: string): Promise<any[]> {
    const managers = await this.userRepo
      .createQueryBuilder('user')
      .leftJoin('user.role', 'role')
      .leftJoin('teams', 'teams', 'teams.manager_id = user.id')
      .where('user.tenant_id = :tenantId', { tenantId })
      .andWhere('role.name = :role', { role: 'Manager' })
      .andWhere('teams.id IS NULL')
      .select(['user.id', 'user.first_name', 'user.last_name', 'user.email'])
      .getMany();

    return managers.map((user) => ({
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      role: 'Manager',
    }));
  }

  async getUnassignedEmployees(
    tenantId: string,
    page: number = 1,
    search?: string,
  ): Promise<{
    items: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const isProvisioned = await this.isTenantSchemaProvisioned(tenantId);
    const limit = 25;
    const skip = (page - 1) * limit;

    const doQuery = async (employeeR: Repository<Employee>) => {
      const qb = employeeR
        .createQueryBuilder('e')
        .leftJoinAndSelect('e.user', 'u')
        .leftJoinAndSelect('e.designation', 'd')
        .leftJoinAndSelect('d.department', 'dep')
        .where('u.tenant_id = :tenantId', { tenantId })
        .andWhere('e.team_id IS NULL')
        .andWhere('e.status = :status', { status: EmployeeStatus.ACTIVE })
        .orderBy('u.first_name', 'ASC');

      if (search) {
        qb.andWhere(
          '(u.first_name ILIKE :search OR u.last_name ILIKE :search)',
          { search: `%${search}%` },
        );
      }

      const [items, total] = await qb.skip(skip).take(limit).getManyAndCount();
      return {
        items: items.map((employee) => ({
          id: employee.id,
          user: {
            id: employee.user.id,
            first_name: employee.user.first_name,
            last_name: employee.user.last_name,
            email: employee.user.email,
            profile_pic: employee.user.profile_pic,
          },
          designation: {
            id: employee.designation.id,
            title: employee.designation.title,
          },
          department: {
            id: employee.designation.department.id,
            name: employee.designation.department.name,
          },
          status: employee.status,
          invite_status: employee.invite_status,
          created_at: employee.created_at,
        })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    };

    if (isProvisioned) {
      return this.tenantDbService.withTenantSchemaReadOnly(tenantId, (em) =>
        doQuery(em.getRepository(Employee)),
      );
    }
    return doQuery(this.employeeRepo);
  }

  async getEmployeePool(
    tenantId: string,
    page: number = 1,
    search?: string,
  ): Promise<{
    items: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    return this.getUnassignedEmployees(tenantId, page, search);
  }

  /**
   * Get all teams across all tenants (for system admin).
   * Schema-provisioned tenants are queried via their dedicated schema.
   */
  async getAllTeamsAcrossTenants(tenantId?: string): Promise<{
    tenants: Array<{
      tenant_id: string;
      tenant_name: string;
      tenant_status: string;
      teams: any[];
    }>;
  }> {
    const tenantWhere: any = { deleted_at: IsNull() };
    if (tenantId) {
      tenantWhere.id = tenantId;
    }

    const tenants = await this.tenantRepo.find({
      where: tenantWhere,
      order: { name: 'ASC' },
    });

    const transformTeam = (t: any) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      manager: t.manager
        ? {
            id: t.manager.id,
            name: `${t.manager.first_name} ${t.manager.last_name}`,
            first_name: t.manager.first_name,
            last_name: t.manager.last_name,
            email: t.manager.email,
            profile_pic: t.manager.profile_pic,
            role: t.manager.role ? t.manager.role.name : undefined,
          }
        : null,
      created_at: t.created_at,
      members: (t.teamMembers || []).map((m: any) => ({
        id: m.id,
        status: m.status,
        user: m.user
          ? {
              id: m.user.id,
              name: `${m.user.first_name} ${m.user.last_name}`,
              email: m.user.email,
              profile_pic: m.user.profile_pic,
            }
          : null,
        designation: m.designation
          ? { id: m.designation.id, title: m.designation.title }
          : null,
        department:
          m.designation && m.designation.department
            ? {
                id: m.designation.department.id,
                name: m.designation.department.name,
              }
            : null,
      })),
    });

    const result: Array<{
      tenant_id: string;
      tenant_name: string;
      tenant_status: string;
      teams: any[];
    }> = [];

    for (const tenant of tenants) {
      const fetchTeams = async (teamR: Repository<Team>) =>
        teamR.find({
          where: { manager: { tenant_id: tenant.id } },
          relations: [
            'manager',
            'manager.role',
            'teamMembers',
            'teamMembers.user',
            'teamMembers.designation',
            'teamMembers.designation.department',
          ],
          order: { created_at: 'DESC' },
        });

      let teams: Team[];
      if (tenant.schema_provisioned) {
        teams = await this.tenantDbService.withTenantSchemaReadOnly(
          tenant.id,
          (em) => fetchTeams(em.getRepository(Team)),
        );
      } else {
        teams = await fetchTeams(this.teamRepo);
      }

      result.push({
        tenant_id: tenant.id,
        tenant_name: tenant.name,
        tenant_status: tenant.status,
        teams: teams.map(transformTeam),
      });
    }

    return { tenants: result };
  }

  /**
   * Sends "New team member joined" email to all existing members of the team (excluding the new member)
   */
  private async sendNewTeamMemberAnnouncementToTeam(
    tenantId: string,
    teamId: string,
    newEmployeeId: string,
    isProvisioned: boolean,
  ): Promise<void> {
    try {
      // Get tenant info
      const tenant = await this.tenantRepo.findOne({
        where: { id: tenantId },
        select: ['name'],
      });
      if (!tenant) {
        this.logger.warn(
          `Tenant not found for announcement (tenant: ${tenantId})`,
        );
        return;
      }

      // Get new employee details
      let newEmployee: Employee | null = null;
      if (isProvisioned) {
        await this.tenantDbService.withTenantSchemaReadOnly(
          tenantId,
          async (em) => {
            newEmployee = await em.getRepository(Employee).findOne({
              where: { id: newEmployeeId },
              relations: ['user', 'designation', 'designation.department'],
            });
          },
        );
      } else {
        newEmployee = await this.employeeRepo.findOne({
          where: { id: newEmployeeId },
          relations: ['user', 'designation', 'designation.department'],
        });
      }

      if (!newEmployee) {
        this.logger.warn(
          `New employee not found for announcement (employee: ${newEmployeeId})`,
        );
        return;
      }

      // Get all existing team members (excluding the new member)
      let existingMembers: Employee[] = [];
      if (isProvisioned) {
        await this.tenantDbService.withTenantSchemaReadOnly(
          tenantId,
          async (em) => {
            const members = await em.getRepository(Employee).find({
              where: { team_id: teamId, id: Not(newEmployeeId) },
              relations: ['user'],
            });
            existingMembers = members;
          },
        );
      } else {
        existingMembers = await this.employeeRepo.find({
          where: { team_id: teamId, id: Not(newEmployeeId) },
          relations: ['user'],
        });
      }

      if (existingMembers.length === 0) {
        this.logger.log(
          `No existing team members to notify for new member (team: ${teamId})`,
        );
        return;
      }

      // Get emails from public user table for all existing members
      const userIds = existingMembers.map((m) => m.user_id).filter(Boolean);
      if (userIds.length === 0) {
        this.logger.log(`No user IDs found for team members (team: ${teamId})`);
        return;
      }

      const usersWithEmails = await this.userRepo.find({
        where: { id: In(userIds) },
        select: ['id', 'email', 'first_name', 'last_name'],
      });

      const emailMap = new Map(usersWithEmails.map((u) => [u.id, u]));

      const recipientDisplayName = (
        first: string | null | undefined,
        last: string | null | undefined,
      ) => `${first ?? ''} ${last ?? ''}`.trim() || 'there';

      // Send email to each existing team member
      for (const member of existingMembers) {
        const user = emailMap.get(member?.user_id);
        if (!user?.email) continue;

        try {
          await this.sendGridService.sendNewTeamMemberAnnouncementEmail({
            recipientEmail: user.email,
            recipientName: recipientDisplayName(
              user.first_name,
              user.last_name,
            ),
            newMember: {
              name: `${newEmployee.user.first_name} ${newEmployee.user.last_name}`.trim(),
              email: newEmployee.user.email,
              department: newEmployee.designation?.department?.name ?? '-',
              jobTitle: newEmployee.designation?.title ?? '-',
              joinedDate:
                newEmployee.created_at?.toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                }) ?? '-',
            },
            companyName: tenant.name,
          });
        } catch (err) {
          this.logger.error(
            `Failed to send team member announcement to ${user.email}: ${String((err as Error)?.message ?? err)}`,
          );
          // Continue with other recipients; do not throw
        }
      }

      this.logger.log(
        `Team member announcement sent to ${existingMembers.length} team member(s) (team: ${teamId})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send team member announcement to team ${teamId}: ${String((error as Error)?.message ?? error)}`,
      );
      // Do not throw - announcement failure should not affect team member addition
    }
  }
}
