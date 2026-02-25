import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

import { TENANT_VALIDATION, TENANT_SWAGGER, TENANT_NAME_MAX_LENGTH } from '../constants/tenant.constants';

export class CreateTenantDto {
  @ApiProperty({
    example: TENANT_SWAGGER.EXAMPLE_NAME,
    description: TENANT_SWAGGER.NAME_FIELD_DESCRIPTION,
  })
  @IsString({ message: TENANT_VALIDATION.NAME_STRING })
  @IsNotEmpty({ message: TENANT_VALIDATION.NAME_REQUIRED })
  @MaxLength(TENANT_NAME_MAX_LENGTH, { message: TENANT_VALIDATION.NAME_MAX_LENGTH })
  name: string;
}
