import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsUUID,
  IsBoolean,
} from 'class-validator';

export class UpdateTenantDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Tenant ID to update',
  })
  @IsUUID(4, { message: 'Tenant ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Tenant ID is required' })
  tenantId: string;

  @ApiPropertyOptional({
    example: 'Updated Company Name',
    description: 'Company/Tenant name',
  })
  @IsOptional()
  @IsString({ message: 'Company name must be a string' })
  @MaxLength(255, { message: 'Company name cannot exceed 255 characters' })
  companyName?: string;

  @ApiPropertyOptional({
    example: 'example.com',
    description: 'Primary domain associated with the tenant',
  })
  @IsOptional()
  @IsString({ message: 'Domain must be a string' })
  @MaxLength(255, { message: 'Domain cannot exceed 255 characters' })
  domain?: string;

  @ApiPropertyOptional({
    example: 'https://example.com/logo.png',
    description: 'Company logo URL',
  })
  @IsOptional()
  @IsString({ message: 'Logo must be a string URL' })
  @MaxLength(500, { message: 'Logo URL cannot exceed 500 characters' })
  logo?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Allow users of this tenant to log in from the mobile app',
  })
  @IsOptional()
  @IsBoolean()
  mobileLoginEnabled?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Enable leave approval workflow for this tenant',
  })
  @IsOptional()
  @IsBoolean()
  leaveWorkflowEnabled?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Enable WFH approval workflow for this tenant',
  })
  @IsOptional()
  @IsBoolean()
  wfhWorkflowEnabled?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Enable overtime approval workflow for this tenant',
  })
  @IsOptional()
  @IsBoolean()
  overtimeWorkflowEnabled?: boolean;
}
