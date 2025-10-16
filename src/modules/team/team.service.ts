import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, DataSource, IsNull } from 'typeorm';
import { Team } from '../../entities/team.entity';
import { Employee } from '../../entities/employee.entity';
import { User } from '../../entities/user.entity';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { EmployeeStatus } from '../../common/constants/enums';

@Injectable()
export class TeamService {
  constructor(
    @InjectRepository(Team)
    private readonly teamRepo: Repository<Team>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly dataSource: DataSource
  ) {}

  async create(tenantId: string, dto: CreateTeamDto): Promise<Team> {
    
    const manager = await this.userRepo.findOne({
      where: { id: dto.manager_id, tenant_id: tenantId },
      relations: ['role'],
    });
    if (!manager) {
      throw new NotFoundException('Manager not found in this tenant');
    }
  
    if (manager.role.name !== 'Manager') {
      throw new BadRequestException('User must have manager role to create a team');
    }
    
    const existingTeam = await this.teamRepo.findOne({
      where: { manager_id: dto.manager_id },
    });
    if (existingTeam) {
      throw new BadRequestException('Manager is already managing another team');
    }
    
    return await this.dataSource.transaction(async (manager) => {
      const teamRepo = manager.getRepository(Team);
      const employeeRepo = manager.getRepository(Employee);
    
      const team = teamRepo.create({
        ...dto,
      });
      const savedTeam = await teamRepo.save(team);
    
      const managerEmployee = await employeeRepo.findOne({
        where: { user_id: dto.manager_id },
      });
      if (managerEmployee) {
        managerEmployee.team_id = savedTeam.id;
        await employeeRepo.save(managerEmployee);
      }
      return savedTeam;
    });
  }

  async findAll(
    tenantId: string,
    page: number = 1
  ): Promise<{
    items: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    employeePool: {
      items: any[];
      total: number;
    };
  }> {
    const limit = 25;
    const skip = (page - 1) * limit;

    const [teams, total] = await this.teamRepo.findAndCount({
      where: { manager: { tenant_id: tenantId } },
      relations: ['manager', 'manager.role', 'teamMembers', 'teamMembers.user', 'teamMembers.designation', 'teamMembers.designation.department'],
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
          ? {
              id: m.designation.id,
              title: m.designation.title,
            }
          : undefined,
        department: m.designation && m.designation.department
          ? {
              id: m.designation.department.id,
              name: m.designation.department.name,
            }
          : undefined,
      })),
    }));

    const totalPages = Math.ceil(total / limit);

    // Get unassigned employees for employee pool
    const unassignedEmployees = await this.employeeRepo.find({
      where: {
        team_id: IsNull(),
        user: { tenant_id: tenantId },
        status: EmployeeStatus.ACTIVE,
      },
      relations: ['user', 'designation', 'designation.department'],
      order: { created_at: 'DESC' },
    });

    const employeePool = unassignedEmployees.map(m => ({
      id: m.id,
      status: m.status,
      user: m.user ? {
        id: m.user.id,
        name: `${m.user.first_name} ${m.user.last_name}`,
        first_name: m.user.first_name,
        last_name: m.user.last_name,
        email: m.user.email,
        profile_pic: m.user.profile_pic,
      } : undefined,
      designation: m.designation ? {
        id: m.designation.id,
        title: m.designation.title,
      } : undefined,
      department: m.designation && m.designation.department ? {
        id: m.designation.department.id,
        name: m.designation.department.name,
      } : undefined,
    }));

    return {
      items,
      total,
      page,
      limit,
      totalPages,
      employeePool: {
        items: employeePool,
        total: employeePool.length,
      },
    };
  }

  async findOne(tenantId: string, id: string): Promise<Team> {
    const team = await this.teamRepo.findOne({
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
  }

  async update(tenantId: string, id: string, dto: UpdateTeamDto): Promise<Team> {
    
    return await this.dataSource.transaction(async (manager) => {
      const teamRepo = manager.getRepository(Team);
      const userRepo = manager.getRepository(User);


      const team = await teamRepo.findOne({
        where: { id, manager: { tenant_id: tenantId } },
        relations: ['manager', 'manager.role'],
      });

      if (!team) {
        throw new NotFoundException('Team not found');
      }

    
      if (dto.manager_id && dto.manager_id !== team.manager_id) {
      
        const newManager = await userRepo.findOne({
          where: { id: dto.manager_id, tenant_id: tenantId },
          relations: ['role'],
        });

        if (!newManager) {
          throw new NotFoundException('New manager not found in this tenant');
        }

        if (newManager.role.name !== 'Manager') {
          throw new BadRequestException('User must have manager role to manage a team');
        }

      
        const existingTeam = await teamRepo.findOne({
          where: { manager_id: dto.manager_id, id: Not(id) },
        });

        if (existingTeam) {
          throw new BadRequestException('New manager is already managing another team');
        }
      }

    
      const updateData: Partial<Team> = {};

      if (dto.name !== undefined) {
        updateData.name = dto.name;
      }
      if (dto.description !== undefined) {
        updateData.description = dto.description;
      }
      if (dto.manager_id !== undefined) {
        updateData.manager_id = dto.manager_id;
      }

    
      await teamRepo.update(id, updateData);

      
      const updatedTeam = await teamRepo.findOne({
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
    });
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const team = await this.findOne(tenantId, id);

    
    await this.employeeRepo.update({ team_id: id }, { team_id: null });

    await this.teamRepo.remove(team);
  }

  
  async getAllTeamMembers(
    tenantId: string,
    page: number = 1
  ): Promise<{
    items: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const limit = 25;
    const skip = (page - 1) * limit;
  
    const qb = this.employeeRepo
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
    const totalPages = Math.ceil(total / limit);
  
    
    const transformedItems = items.map((employee) => ({
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
      team: {
        id: employee.team.id,
        name: employee.team.name,
      },
    }));
  
    return {
      items: transformedItems,
      total,
      page,
      limit,
      totalPages,
    };
  }





  async getTeamMembers(
    tenantId: string,
    teamId: string,
    page: number = 1
  ): Promise<{
    items: Employee[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const limit = 25;
    const skip = (page - 1) * limit;
    const [items, total] = await this.employeeRepo.findAndCount({
      where: {
        team_id: teamId,
        user: { tenant_id: tenantId },
      },
      relations: ['user', 'designation', 'designation.department'],
      order: { created_at: 'ASC' },
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

  async getManagerTeams(managerId: string, tenantId: string): Promise<Team[]> {
    const teams = await this.teamRepo.find({
      where: {
        manager_id: managerId,
        manager: { tenant_id: tenantId },
      },
      relations: ['teamMembers', 'teamMembers.user', 'teamMembers.designation'],
    });

    return teams;
  }

  async addMemberToTeam(tenantId: string, teamId: string, employeeId: string): Promise<void> {
    const team = await this.findOne(tenantId, teamId);

    const employee = await this.employeeRepo.findOne({
      where: {
        id: employeeId,
        user: { tenant_id: tenantId },
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found in this tenant');
    }

    if (employee.team_id) {
      throw new BadRequestException('Employee is already part of a team');
    }

    employee.team_id = teamId;
    await this.employeeRepo.save(employee);
  }

  async removeMemberFromTeam(tenantId: string, teamId: string, employeeId: string): Promise<void> {
    const team = await this.findOne(tenantId, teamId);

    const employee = await this.employeeRepo.findOne({
      where: {
        id: employeeId,
        team_id: teamId,
        user: { tenant_id: tenantId },
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found in this team');
    }

    employee.team_id = null;
    await this.employeeRepo.save(employee);
  }

  async getAvailableEmployees(
    tenantId: string,
    managerId: string,
    page = 1,
    search?: string
  ): Promise<{
    items: any[]; 
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const limit = 25;
    const skip = (page - 1) * limit;
  
    const manager = await this.employeeRepo.findOne({
      where: { user_id: managerId },
      relations: ['designation', 'designation.department'],
    });
    if (!manager?.designation?.department) {
      throw new BadRequestException('Manager must belong to a department');
    }
    const qb = this.employeeRepo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.user', 'u')
      .leftJoinAndSelect('e.designation', 'd')
      .leftJoinAndSelect('d.department', 'dep')
      .where('u.tenant_id = :tenantId', { tenantId })
      .andWhere('dep.id = :deptId', { deptId: manager.designation.department.id })
      .andWhere('e.team_id IS NULL')
      .andWhere('e.user_id != :managerId', { managerId });
    if (search) {
      qb.andWhere('(u.first_name ILIKE :search OR u.last_name ILIKE :search)', {
        search: `%${search}%`,
      });
    }
    const [items, total] = await qb
      .orderBy('u.first_name', 'ASC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();
    const totalPages = Math.ceil(total / limit);
    
    const transformedItems = items.map((employee) => ({
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
    }));
    return {
      items: transformedItems, 
      total,
      page,
      limit,
      totalPages,
    };
  }
  async getAllMembersForManager(
    tenantId: string,
    managerId: string,
    page = 1
  ): Promise<{
    items: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const limit = 25;
    const skip = (page - 1) * limit;
    const qb = this.employeeRepo
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
    const totalPages = Math.ceil(total / limit);
    
    const transformedItems = items.map((employee) => ({
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
    }));
    return {
      items: transformedItems,
      total,
      page,
      limit,
      totalPages,
    };
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
    search?: string
  ): Promise<{
    items: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const limit = 25;
    const skip = (page - 1) * limit;

    const qb = this.employeeRepo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.user', 'u')
      .leftJoinAndSelect('e.designation', 'd')
      .leftJoinAndSelect('d.department', 'dep')
      .where('u.tenant_id = :tenantId', { tenantId })
      .andWhere('e.team_id IS NULL')
      .andWhere('e.status = :status', { status: EmployeeStatus.ACTIVE })
      .orderBy('u.first_name', 'ASC');

    if (search) {
      qb.andWhere('(u.first_name ILIKE :search OR u.last_name ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    const [items, total] = await qb
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const totalPages = Math.ceil(total / limit);

    const transformedItems = items.map((employee) => ({
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
    }));

    return {
      items: transformedItems,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async getEmployeePool(
    tenantId: string,
    page: number = 1,
    search?: string
  ): Promise<{
    items: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const limit = 25;
    const skip = (page - 1) * limit;

    const qb = this.employeeRepo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.user', 'u')
      .leftJoinAndSelect('e.designation', 'd')
      .leftJoinAndSelect('d.department', 'dep')
      .where('u.tenant_id = :tenantId', { tenantId })
      .andWhere('e.team_id IS NULL')
      .andWhere('e.status = :status', { status: EmployeeStatus.ACTIVE })
      .orderBy('u.first_name', 'ASC');

    if (search) {
      qb.andWhere('(u.first_name ILIKE :search OR u.last_name ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    const [items, total] = await qb
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const totalPages = Math.ceil(total / limit);

    
    const transformedItems = items.map((employee) => ({
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
    }));

    return {
      items: transformedItems,
      total,
      page,
      limit,
      totalPages,
    };
  }
}
