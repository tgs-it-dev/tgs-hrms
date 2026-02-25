import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

import { TENANT_VALIDATION } from '../constants/tenant.constants';

export class CreateTenantDto {
  @ApiProperty({
    example: 'Default Company',
    description: 'Tenant name',
  })
  @IsString({ message: TENANT_VALIDATION.NAME_STRING })
  @IsNotEmpty({ message: TENANT_VALIDATION.NAME_REQUIRED })
  @MaxLength(255, { message: TENANT_VALIDATION.NAME_MAX_LENGTH })
  name: string;
}
