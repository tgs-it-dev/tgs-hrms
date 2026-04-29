import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository, In, Not } from 'typeorm';
import { Geofence, GeofenceStatus, GeofenceType } from '../../entities/geofence.entity';
import { Team } from '../../entities/team.entity';
import { Employee } from '../../entities/employee.entity';
import { CreateGeofenceDto } from './dto/create-geofence.dto';
import { UpdateGeofenceDto } from './dto/update-geofence.dto';
import { getPostgresErrorCode } from '../../common/types/database.types';
import { calculateDistance } from '../../common/utils/geofence.util';
import { TenantDatabaseService } from '../../common/services/tenant-database.service';

@Injectable()
export class GeofenceService {
  constructor(
    @InjectRepository(Geofence)
    private readonly repo: Repository<Geofence>,
    @InjectRepository(Team)
    private readonly teamRepo: Repository<Team>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    private readonly tenantDbService: TenantDatabaseService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  private async isTenantSchemaProvisioned(tenantId: string): Promise<boolean> {
    const result = await this.dataSource.query<{ schema_provisioned: boolean }[]>(
      `SELECT schema_provisioned FROM public.tenants WHERE id = $1 LIMIT 1`,
      [tenantId],
    );
    return result[0]?.schema_provisioned ?? false;
  }

  private validateCoordinates(coordinates: unknown): asserts coordinates is number[][] {
    if (!Array.isArray(coordinates)) {
      throw new BadRequestException('coordinates must be an array of [latitude, longitude] pairs');
    }

    for (const pair of coordinates) {
      if (!Array.isArray(pair) || pair.length !== 2) {
        throw new BadRequestException('coordinates must be an array of [latitude, longitude] pairs');
      }
      const [lat, lng] = pair;
      if (typeof lat !== 'number' || Number.isNaN(lat) || typeof lng !== 'number' || Number.isNaN(lng)) {
        throw new BadRequestException('coordinates must contain numeric [latitude, longitude] pairs');
      }
      if (lat < -90 || lat > 90) {
        throw new BadRequestException('latitude must be between -90 and 90');
      }
      if (lng < -180 || lng > 180) {
        throw new BadRequestException('longitude must be between -180 and 180');
      }
    }
  }

  private getCentroidOrFirstVertex(coordinates: number[][]): { latitude: number; longitude: number } {
    if (coordinates.length === 0) {
      throw new BadRequestException('coordinates cannot be empty');
    }
    // Simple centroid (average of vertices). Good enough for UI placement/backward compatibility.
    let sumLat = 0;
    let sumLng = 0;
    for (const [lat, lng] of coordinates) {
      sumLat += lat;
      sumLng += lng;
    }
    return { latitude: sumLat / coordinates.length, longitude: sumLng / coordinates.length };
  }

    async create(
    tenant_id: string,
    dto: CreateGeofenceDto,
    user_id?: string,
    user_role?: string,
  ): Promise<Geofence> {
    const isProvisioned = await this.isTenantSchemaProvisioned(tenant_id);
    if (isProvisioned) {
      return this.tenantDbService.withTenantSchema(tenant_id, (em) => this.doCreate(em, tenant_id, dto, user_id, user_role));
    }
    return this.doCreate(null, tenant_id, dto, user_id, user_role);
  }

  private async doCreate(
    em: EntityManager | null,
    tenant_id: string,
    dto: CreateGeofenceDto,
    user_id?: string,
    user_role?: string,
  ): Promise<Geofence> {
    const repo = em ? em.getRepository(Geofence) : this.repo;
    const teamRepo = em ? em.getRepository(Team) : this.teamRepo;
    const employeeRepo = em ? em.getRepository(Employee) : this.employeeRepo;

    // Verify team exists and belongs to tenant
    const team = await teamRepo.findOne({
      where: { id: dto.team_id },
      relations: ['manager'],
    });

    if (!team) {
      throw new NotFoundException('Team not found.');
    }

    // Check if team belongs to tenant (via manager's tenant_id)
    if (team.manager.tenant_id !== tenant_id) {
      throw new BadRequestException('Team does not belong to your organization.');
    }

    // If user is a manager, verify they manage this team
    if (user_role === 'manager' && user_id) {
      if (team.manager_id !== user_id) {
        throw new ForbiddenException('You can only create geofences for teams you manage.');
      }
    }

    // Check for duplicate name within the same team
    const existing = await repo.findOne({
      where: { tenant_id, team_id: dto.team_id, name: dto.name },
    });
    if (existing) {
      throw new ConflictException(
        `Geofence '${dto.name}' already exists for this team.`,
      );
    }

    try {
      const hasCoords = dto.coordinates !== undefined && dto.coordinates !== null && dto.coordinates.length > 0;
      const coordCount = dto.coordinates?.length ?? 0;
      const type =
        dto.type ??
        (coordCount === 4 ? GeofenceType.RECTANGLE : hasCoords ? GeofenceType.POLYGON : null);

      let latitude = dto.latitude;
      let longitude = dto.longitude;
      let coordinates: number[][] | null = null;
      let radius: number | null = dto.radius ?? null;

      if (hasCoords) {
        this.validateCoordinates(dto.coordinates);
        const coords = dto.coordinates;

        if (type === GeofenceType.RECTANGLE) {
          if (coords.length !== 4) {
            throw new BadRequestException(
              "Rectangle geofence requires exactly 4 coordinates [lat, lng].",
            );
          }
          coordinates = coords;
          const center = this.getCentroidOrFirstVertex(coordinates);
          latitude = center.latitude;
          longitude = center.longitude;
        } else if (type === GeofenceType.CIRCLE) {
          const center = this.getCentroidOrFirstVertex(coords);
          latitude = center.latitude;
          longitude = center.longitude;
          let maxDist = 0;
          for (const [lat, lng] of coords) {
            const d = calculateDistance(center.latitude, center.longitude, lat, lng);
            if (d > maxDist) maxDist = d;
          }
          radius = maxDist;
          coordinates = null;
        } else {
          coordinates = coords;
          const center = this.getCentroidOrFirstVertex(coordinates);
          latitude = center.latitude;
          longitude = center.longitude;
        }
      }

      if (type === GeofenceType.CIRCLE && !hasCoords) {
        if (radius === null || radius === undefined) {
          throw new BadRequestException("radius is required when type='circle'");
        }
        if (latitude === undefined || longitude === undefined) {
          throw new BadRequestException(
            "latitude and longitude are required when type='circle'",
          );
        }
        coordinates = null;
      }

      if (latitude === undefined || longitude === undefined) {
        throw new BadRequestException(
          'Either coordinates must be provided, or latitude/longitude must be provided',
        );
      }

      // Business Logic: If new geofence is being created as ACTIVE, deactivate all existing ACTIVE geofences for this team
      const newStatus = dto.status ?? GeofenceStatus.ACTIVE;
      if (newStatus === GeofenceStatus.ACTIVE) {
        // Deactivate all existing active geofences for this team
        await repo.update(
          {
            tenant_id,
            team_id: dto.team_id,
            status: GeofenceStatus.ACTIVE,
          },
          {
            status: GeofenceStatus.INACTIVE,
          },
        );
      }

      const geofence = repo.create({
        tenant_id,
        team_id: dto.team_id,
        name: dto.name,
        description: dto.description ?? null,
        type,
        radius: radius !== null && radius !== undefined ? String(radius) : null,
        coordinates,
        latitude: String(latitude),
        longitude: String(longitude),
        status: newStatus,
        threshold_distance: dto.threshold_distance !== undefined && dto.threshold_distance !== null ? String(dto.threshold_distance) : null,
        threshold_enabled: dto.threshold_enabled ?? false,
      });
      return await repo.save(geofence);
    } catch (err) {
      const errorCode = getPostgresErrorCode(err);
      if (errorCode === '23505') {
        throw new ConflictException(
          'Geofence name must be unique within the team',
        );
      }
      if (errorCode === '23502') {
        throw new BadRequestException(
          'Geofence name, team_id, latitude and longitude are required.',
        );
      }
      throw err;
    }
  }

    async findAll(
    tenant_id: string,
    team_id?: string,
    user_id?: string,
    user_role?: string,
  ): Promise<Geofence[]> {
    const isProvisioned = await this.isTenantSchemaProvisioned(tenant_id);
    if (isProvisioned) {
      return this.tenantDbService.withTenantSchemaReadOnly(tenant_id, (em) => this.doFindAll(em, tenant_id, team_id, user_id, user_role));
    }
    return this.doFindAll(null, tenant_id, team_id, user_id, user_role);
  }

  private async doFindAll(
    em: EntityManager | null,
    tenant_id: string,
    team_id?: string,
    user_id?: string,
    user_role?: string,
  ): Promise<Geofence[]> {
    const repo = em ? em.getRepository(Geofence) : this.repo;
    const teamRepo = em ? em.getRepository(Team) : this.teamRepo;
    const employeeRepo = em ? em.getRepository(Employee) : this.employeeRepo;

    // If user is a manager, only show geofences for teams they manage
    if (user_role === 'manager' && user_id) {
      const managerTeams = await teamRepo.find({
        where: { manager_id: user_id, manager: { tenant_id } },
      });
      const teamIds = managerTeams.map((t) => t.id);
      if (teamIds.length === 0) {
        return [];
      }

      // If team_id is provided, verify manager manages that team
      if (team_id) {
        if (!teamIds.includes(team_id)) {
          return [];
        }
        return repo.find({
          where: { tenant_id, team_id },
          relations: ['team', 'team.manager'],
          order: { created_at: 'DESC' },
        });
      }

      // Otherwise, return all geofences for teams the manager manages
      return repo.find({
        where: { tenant_id, team_id: In(teamIds) },
        relations: ['team', 'team.manager'],
        order: { created_at: 'DESC' },
      });
    }

    // If user is an employee, automatically filter by their team_id
    if (user_role === 'employee' && user_id) {
      const employee = await employeeRepo.findOne({
        where: { user_id },
      });

      if (!employee) {
        throw new NotFoundException('Employee not found.');
      }

      if (!employee.team_id) {
        // Employee has no team, return empty array
        return [];
      }

      // Override team_id with employee's team_id to ensure team isolation
      const employeeTeamId = employee.team_id;

      return repo.find({
        where: { tenant_id, team_id: employeeTeamId },
        relations: ['team', 'team.manager'],
        order: { created_at: 'DESC' },
      });
    }

    // For admin/hr-admin/system-admin, team_id is mandatory to ensure team isolation
    if (!team_id) {
      throw new BadRequestException(
        'team_id is required. Geofences are team-specific and must be filtered by team_id to ensure proper team isolation.',
      );
    }

    // Verify team belongs to tenant
    const team = await teamRepo.findOne({
      where: { id: team_id },
      relations: ['manager'],
    });

    if (!team) {
      throw new NotFoundException('Team not found.');
    }

    if (team.manager.tenant_id !== tenant_id) {
      throw new BadRequestException('Team does not belong to your organization.');
    }

    return repo.find({
      where: { tenant_id, team_id },
      relations: ['team', 'team.manager'],
      order: { created_at: 'DESC' },
    });
  }

    async findOne(
    tenant_id: string,
    id: string,
    user_id?: string,
    user_role?: string,
  ): Promise<Geofence> {
    const isProvisioned = await this.isTenantSchemaProvisioned(tenant_id);
    if (isProvisioned) {
      return this.tenantDbService.withTenantSchemaReadOnly(tenant_id, (em) => this.doFindOne(em, tenant_id, id, user_id, user_role));
    }
    return this.doFindOne(null, tenant_id, id, user_id, user_role);
  }

  private async doFindOne(
    em: EntityManager | null,
    tenant_id: string,
    id: string,
    user_id?: string,
    user_role?: string,
  ): Promise<Geofence> {
    const repo = em ? em.getRepository(Geofence) : this.repo;
    const teamRepo = em ? em.getRepository(Team) : this.teamRepo;
    const employeeRepo = em ? em.getRepository(Employee) : this.employeeRepo;

    const geofence = await repo.findOne({
      where: { id, tenant_id },
      relations: ['team', 'team.manager'],
    });

    if (!geofence) {
      throw new NotFoundException('Geofence not found.');
    }

    // If user is a manager, verify they manage this team
    if (user_role === 'manager' && user_id) {
      if (geofence.team.manager_id !== user_id) {
        throw new ForbiddenException(
          'You can only view geofences for teams you manage.',
        );
      }
    }

    return geofence;
  }

    async update(
    tenant_id: string,
    id: string,
    dto: UpdateGeofenceDto,
    user_id?: string,
    user_role?: string,
  ): Promise<Geofence> {
    const isProvisioned = await this.isTenantSchemaProvisioned(tenant_id);
    if (isProvisioned) {
      return this.tenantDbService.withTenantSchema(tenant_id, (em) => this.doUpdate(em, tenant_id, id, dto, user_id, user_role));
    }
    return this.doUpdate(null, tenant_id, id, dto, user_id, user_role);
  }

  private async doUpdate(
    em: EntityManager | null,
    tenant_id: string,
    id: string,
    dto: UpdateGeofenceDto,
    user_id?: string,
    user_role?: string,
  ): Promise<Geofence> {
    const repo = em ? em.getRepository(Geofence) : this.repo;
    const teamRepo = em ? em.getRepository(Team) : this.teamRepo;
    const employeeRepo = em ? em.getRepository(Employee) : this.employeeRepo;

    const geofence = await repo.findOne({
      where: { id, tenant_id },
      relations: ['team', 'team.manager'],
    });

    if (!geofence) {
      throw new NotFoundException('Geofence not found.');
    }

    // If user is a manager, verify they manage this team
    if (user_role === 'manager' && user_id) {
      if (geofence.team.manager_id !== user_id) {
        throw new ForbiddenException(
          'You can only update geofences for teams you manage.',
        );
      }
    }

    // If team_id is being changed, verify new team exists and belongs to tenant
    if (dto.team_id && dto.team_id !== geofence.team_id) {
      const newTeam = await teamRepo.findOne({
        where: { id: dto.team_id },
        relations: ['manager'],
      });

      if (!newTeam) {
        throw new NotFoundException('Team not found.');
      }

      if (newTeam.manager.tenant_id !== tenant_id) {
        throw new BadRequestException('Team does not belong to your organization.');
      }

      // If user is a manager, verify they manage the new team
      if (user_role === 'manager' && user_id) {
        if (newTeam.manager_id !== user_id) {
          throw new ForbiddenException(
            'You can only assign geofences to teams you manage.',
          );
        }
      }

      // Business Logic: If geofence is ACTIVE and being moved to a new team, deactivate all ACTIVE geofences in the new team
      const willBeActive = dto.status !== undefined ? dto.status === GeofenceStatus.ACTIVE : geofence.status === GeofenceStatus.ACTIVE;
      if (willBeActive) {
        await repo.update(
          {
            tenant_id,
            team_id: dto.team_id,
            status: GeofenceStatus.ACTIVE,
            id: Not(geofence.id), // Exclude current geofence
          },
          {
            status: GeofenceStatus.INACTIVE,
          },
        );
      }

      geofence.team_id = dto.team_id;
    }

    // Check for duplicate name within the same team (if name or team_id changed)
    if (dto.name && dto.name !== geofence.name) {
      const existing = await repo.findOne({
        where: {
          tenant_id,
          team_id: dto.team_id || geofence.team_id,
          name: dto.name,
        },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Geofence name '${dto.name}' already exists for this team.`,
        );
      }
    }

    if (dto.name !== undefined) geofence.name = dto.name;
    if (dto.description !== undefined)
      geofence.description = dto.description === '' ? null : dto.description;
    // Shape fields
    if (dto.type !== undefined) geofence.type = dto.type ?? null;
    if (dto.radius !== undefined) geofence.radius = dto.radius === null ? null : String(dto.radius);
    if (dto.coordinates !== undefined) {
      if (dto.coordinates === null || dto.coordinates.length === 0) {
        geofence.coordinates = null;
      } else {
        this.validateCoordinates(dto.coordinates);
        const coords = dto.coordinates;
        const effectiveType =
          dto.type ??
          geofence.type ??
          (coords.length === 4 ? GeofenceType.RECTANGLE : GeofenceType.POLYGON);

        if (dto.type === undefined && coords.length === 4) {
          geofence.type = GeofenceType.RECTANGLE;
        }

        if (effectiveType === GeofenceType.RECTANGLE) {
          if (coords.length !== 4) {
            throw new BadRequestException(
              "Rectangle geofence requires exactly 4 coordinates [lat, lng].",
            );
          }
          geofence.coordinates = coords;
          const center = this.getCentroidOrFirstVertex(coords);
          geofence.latitude = String(center.latitude);
          geofence.longitude = String(center.longitude);
        } else if (effectiveType === GeofenceType.CIRCLE) {
          const center = this.getCentroidOrFirstVertex(coords);
          geofence.latitude = String(center.latitude);
          geofence.longitude = String(center.longitude);
          let maxDist = 0;
          for (const [lat, lng] of coords) {
            const d = calculateDistance(center.latitude, center.longitude, lat, lng);
            if (d > maxDist) maxDist = d;
          }
          geofence.radius = String(maxDist);
          geofence.coordinates = null;
        } else {
          geofence.coordinates = coords;
          const center = this.getCentroidOrFirstVertex(coords);
          geofence.latitude = String(center.latitude);
          geofence.longitude = String(center.longitude);
        }
      }
    }

    // Backward compatibility: allow direct lat/lng update (e.g. circle center)
    if (dto.latitude !== undefined) geofence.latitude = String(dto.latitude);
    if (dto.longitude !== undefined) geofence.longitude = String(dto.longitude);

    // If type is circle, require radius and center
    if (geofence.type === GeofenceType.CIRCLE) {
      if (!geofence.radius) {
        throw new BadRequestException("radius is required when type='circle'");
      }
      if (!geofence.latitude || !geofence.longitude) {
        throw new BadRequestException("latitude and longitude are required when type='circle'");
      }
    }

    // Business Logic: If geofence status is being changed to ACTIVE, deactivate all other ACTIVE geofences for this team
    if (dto.status !== undefined) {
      if (dto.status === GeofenceStatus.ACTIVE && geofence.status !== GeofenceStatus.ACTIVE) {
        // Deactivate all existing active geofences for this team (except the current one)
        await repo.update(
          {
            tenant_id,
            team_id: geofence.team_id,
            status: GeofenceStatus.ACTIVE,
            id: Not(geofence.id), // Exclude current geofence
          },
          {
            status: GeofenceStatus.INACTIVE,
          },
        );
      }
      geofence.status = dto.status;
    }

    // Threshold fields
    if (dto.threshold_distance !== undefined) {
      geofence.threshold_distance = dto.threshold_distance === null ? null : String(dto.threshold_distance);
    }
    if (dto.threshold_enabled !== undefined) {
      geofence.threshold_enabled = dto.threshold_enabled;
    }

    try {
      return await repo.save(geofence);
    } catch (err) {
      const errorCode = getPostgresErrorCode(err);
      if (errorCode === '23505') {
        throw new ConflictException(
          'Geofence name must be unique within the team',
        );
      }
      throw err;
    }
  }

    async remove(
    tenant_id: string,
    id: string,
    user_id?: string,
    user_role?: string,
  ): Promise<{ deleted: true; id: string }> {
    const isProvisioned = await this.isTenantSchemaProvisioned(tenant_id);
    if (isProvisioned) {
      return this.tenantDbService.withTenantSchema(tenant_id, (em) => this.doRemove(em, tenant_id, id, user_id, user_role));
    }
    return this.doRemove(null, tenant_id, id, user_id, user_role);
  }

  private async doRemove(
    em: EntityManager | null,
    tenant_id: string,
    id: string,
    user_id?: string,
    user_role?: string,
  ): Promise<{ deleted: true; id: string }> {
    const repo = em ? em.getRepository(Geofence) : this.repo;
    const teamRepo = em ? em.getRepository(Team) : this.teamRepo;
    const employeeRepo = em ? em.getRepository(Employee) : this.employeeRepo;

    const geofence = await repo.findOne({
      where: { id, tenant_id },
      relations: ['team', 'team.manager'],
    });

    if (!geofence) {
      throw new NotFoundException('Geofence not found.');
    }

    // If user is a manager, verify they manage this team
    if (user_role === 'manager' && user_id) {
      if (geofence.team.manager_id !== user_id) {
        throw new ForbiddenException(
          'You can only delete geofences for teams you manage.',
        );
      }
    }

    await repo.delete({ id, tenant_id });
    return { deleted: true, id };
  }
}

