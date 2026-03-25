import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { GeofenceStatus, GeofenceType } from '../../../entities/geofence.entity';

export class CreateGeofenceDto {
  @ApiProperty({ example: 'Head Office' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: 'Main building entrance area', required: false })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value === '' ? null : value))
  description?: string | null;

  @ApiProperty({ example: 'uuid-of-team' })
  @IsUUID()
  @IsNotEmpty()
  team_id: string;

  @ApiProperty({ example: GeofenceType.POLYGON, enum: GeofenceType, required: false })
  @IsOptional()
  @IsEnum(GeofenceType)
  type?: GeofenceType;

  @ApiProperty({ example: 150, required: false, description: "Circle radius (meters). Required when type='circle'." })
  @IsOptional()
  @Transform(({ value }) => (value === '' || value === null || value === undefined ? value : Number(value)))
  @IsNumber()
  @Min(0)
  radius?: number;

  @ApiProperty({
    example: [
      [24.860734, 67.001136],
      [24.8608, 67.0012],
    ],
    required: false,
    description: 'Coordinates stored as [[lat, lng], ...] (numeric pairs).',
  })
  @IsOptional()
  @IsArray()
  coordinates?: number[][];

  @ApiProperty({ example: 24.860734, required: false, description: 'Backward compatible center/point latitude.' })
  @Transform(({ value }) => (value === '' || value === null || value === undefined ? value : Number(value)))
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiProperty({ example: 67.001136, required: false, description: 'Backward compatible center/point longitude.' })
  @Transform(({ value }) => (value === '' || value === null || value === undefined ? value : Number(value)))
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiProperty({ example: GeofenceStatus.ACTIVE, enum: GeofenceStatus, required: false })
  @IsOptional()
  @IsEnum(GeofenceStatus)
  status?: GeofenceStatus;

  @ApiProperty({ 
    example: 50, 
    required: false, 
    description: 'Threshold distance in meters (tolerance outside the boundary). Only used when threshold_enabled is true.' 
  })
  @IsOptional()
  @Transform(({ value }) => (value === '' || value === null || value === undefined ? value : Number(value)))
  @IsNumber()
  @Min(0)
  threshold_distance?: number;

  @ApiProperty({ 
    example: false, 
    required: false, 
    description: 'Whether threshold distance is enabled. If enabled, employees within threshold can check in and action is marked as "Near Boundary".' 
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  threshold_enabled?: boolean;
}

