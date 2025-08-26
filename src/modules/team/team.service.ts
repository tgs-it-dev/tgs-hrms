import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { Team } from '../../entities/team.entity';
import { Employee } from '../../entities/employee.entity';
import { User } from '../../entities/user.entity';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';

@Injectable()
export class TeamService {
  constructor(
    @InjectRepository(Team)
    private readonly teamRepo: Repository<Team>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async create(tenantId: string, dto: CreateTeamDto): Promise<Team> {
    // Verify the manager exists and belongs to the tenant
    const manager = await this.userRepo.findOne({
      where: { id: dto.manager_id, tenant_id: tenantId },
      relations: ['role'],
    });

    if (!manager) {
      throw new NotFoundException('Manager not found in this tenant');
    }

    // Verify the manager has a manager role
    if (manager.role.name !== 'Manager') {
      throw new BadRequestException('User must have manager role to create a team');
    }

    // Check if manager is already managing another team
    const existingTeam = await this.teamRepo.findOne({
      where: { manager_id: dto.manager_id },
    });

    if (existingTeam) {
      throw new BadRequestException('Manager is already managing another team');
    }

    const team = this.teamRepo.create({
      ...dto,
    });

    return this.teamRepo.save(team);
  }

  async findAll(tenantId: string, page: number = 1): Promise<{
    items: Team[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const limit = 25;
    const skip = (page - 1) * limit;

    const [items, total] = await this.teamRepo.findAndCount({
      where: { manager: { tenant_id: tenantId } },
      relations: ['manager', 'manager.role'],
      order: { created_at: 'DESC' },
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

  async findOne(tenantId: string, id: string): Promise<Team> {
    const team = await this.teamRepo.findOne({
      where: { id, manager: { tenant_id: tenantId } },
      relations: ['manager', 'manager.role', 'teamMembers', 'teamMembers.user', 'teamMembers.designation'],
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    return team;
  }

  async update(tenantId: string, id: string, dto: UpdateTeamDto): Promise<Team> {
    const team = await this.findOne(tenantId, id);

    if (dto.manager_id && dto.manager_id !== team.manager_id) {
      // Verify the new manager exists and belongs to the tenant
      const newManager = await this.userRepo.findOne({
        where: { id: dto.manager_id, tenant_id: tenantId },
        relations: ['role'],
      });

      if (!newManager) {
        throw new NotFoundException('New manager not found in this tenant');
      }

      if (newManager.role.name !== 'manager') {
        throw new BadRequestException('User must have manager role to manage a team');
      }

      // Check if new manager is already managing another team
      const existingTeam = await this.teamRepo.findOne({
        where: { manager_id: dto.manager_id, id: Not(id) },
      });

      if (existingTeam) {
        throw new BadRequestException('New manager is already managing another team');
      }
    }

    Object.assign(team, dto);
    return this.teamRepo.save(team);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const team = await this.findOne(tenantId, id);

    // Remove team_id from all team members
    await this.employeeRepo.update(
      { team_id: id },
      { team_id: null }
    );

    await this.teamRepo.remove(team);
  }

  async getTeamMembers(tenantId: string, teamId: string, page: number = 1): Promise<{
    items: Employee[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const limit = 25;
    const skip = (page - 1) * limit;

    // First get the team to find the manager_id
    const team = await this.teamRepo.findOne({
      where: { id: teamId },
      select: ['manager_id']
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const [items, total] = await this.employeeRepo.findAndCount({
      where: { 
        team_id: teamId,
        user: { tenant_id: tenantId },
        user_id: team.manager_id ? Not(team.manager_id) : undefined // Exclude manager
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
        manager: { tenant_id: tenantId }
      },
      relations: ['teamMembers', 'teamMembers.user', 'teamMembers.designation'],
    });

    // Filter out the manager from team members for each team
    teams.forEach(team => {
      team.teamMembers = team.teamMembers.filter(member => member.user_id !== managerId);
    });

    return teams;
  }

  async addMemberToTeam(tenantId: string, teamId: string, employeeId: string): Promise<void> {
    const team = await this.findOne(tenantId, teamId);
    
    const employee = await this.employeeRepo.findOne({
      where: { 
        id: employeeId,
        user: { tenant_id: tenantId }
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
        user: { tenant_id: tenantId }
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
    items: Employee[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const limit = 25;
    const skip = (page - 1) * limit;

    // Get manager's department
    const manager = await this.employeeRepo.findOne({
      where: { user_id: managerId },
      relations: ['designation', 'designation.department']
    });

    if (!manager?.designation?.department) {
      throw new BadRequestException('Manager must belong to a department');
    }

    const qb = this.employeeRepo.createQueryBuilder('e')
      .leftJoinAndSelect('e.user', 'u')
      .leftJoinAndSelect('e.designation', 'd')
      .leftJoinAndSelect('d.department', 'dep')
      .where('u.tenant_id = :tenantId', { tenantId })
      .andWhere('dep.id = :deptId', { deptId: manager.designation.department.id })
      .andWhere('e.team_id IS NULL') // Only employees not in any team
      .andWhere('e.user_id != :managerId', { managerId }); // Exclude manager

    if (search) {
      qb.andWhere('(u.first_name ILIKE :search OR u.last_name ILIKE :search)', { 
        search: `%${search}%` 
      });
    }

    const [items, total] = await qb
      .orderBy('u.first_name', 'ASC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const totalPages = Math.ceil(total / limit);

    return {
      items,
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
    items: Employee[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const limit = 25;
    const skip = (page - 1) * limit;

    const qb = this.employeeRepo.createQueryBuilder('e')
      .leftJoinAndSelect('e.user', 'u')
      .leftJoinAndSelect('e.designation', 'd')
      .leftJoinAndSelect('d.department', 'dep')
      .leftJoin('e.team', 't')
      .where('u.tenant_id = :tenantId', { tenantId })
      .andWhere('t.manager_id = :managerId', { managerId })
      .andWhere('e.user_id != :managerId', { managerId }); // Exclude manager

    const [items, total] = await qb
      .orderBy('e.created_at', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const totalPages = Math.ceil(total / limit);

    return {
      items,
      total,
      page,
      limit,
      totalPages,
    };
  }
}
