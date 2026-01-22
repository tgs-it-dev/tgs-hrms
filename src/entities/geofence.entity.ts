import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Tenant } from './tenant.entity';
import { Team } from './team.entity';

export enum GeofenceStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export enum GeofenceType {
  POLYGON = 'polygon',
  RECTANGLE = 'rectangle',
  CIRCLE = 'circle',
}

@Index(['tenant_id'])
@Index(['team_id'])
@Index(['name'])
@Index(['status'])
@Index(['tenant_id', 'team_id', 'name'], { unique: true })
@Entity('geofences')
export class Geofence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenant_id: string;

  @ManyToOne(() => Tenant, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'uuid' })
  team_id: string;

  @ManyToOne(() => Team, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team: Team;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  /**
   * Shape type (polygon/rectangle/circle). Nullable for backward compatibility.
   */
  @Column({ type: 'varchar', length: 32, nullable: true })
  type: GeofenceType | null;

  /**
   * Circle radius (meters). Nullable unless type='circle'.
   */
  @Column({ type: 'numeric', nullable: true })
  radius: string | null;

  /**
   * Coordinates stored as JSONB: [[lat, lng], ...]
   * Nullable. For circles, center is stored in latitude/longitude and radius in radius.
   */
  @Column({ type: 'jsonb', nullable: true })
  coordinates: number[][] | null;

  // Coordinates (Latitude, Longitude)
  @Column({ type: 'numeric', precision: 10, scale: 7 })
  latitude: string;

  @Column({ type: 'numeric', precision: 10, scale: 7 })
  longitude: string;

  @Column({ type: 'varchar', length: 10, default: GeofenceStatus.ACTIVE })
  status: GeofenceStatus;

  /**
   * Threshold distance in meters (tolerance outside the boundary).
   * Nullable. Only used when threshold_enabled is true.
   */
  @Column({ type: 'numeric', nullable: true })
  threshold_distance: string | null;

  /**
   * Whether threshold distance is enabled.
   * If enabled, employees within threshold can check in and action is marked as "Near Boundary".
   * If disabled, employees must be strictly inside the geofence.
   */
  @Column({ type: 'boolean', default: false })
  threshold_enabled: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}

