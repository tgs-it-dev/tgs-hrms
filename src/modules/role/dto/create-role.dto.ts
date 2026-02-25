import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

import { ROLE_VALIDATION, ROLE_SWAGGER, ROLE_NAME_MAX_LENGTH } from '../constants/role.constants';

export class CreateRoleDto {
  @ApiProperty({
    example: ROLE_SWAGGER.EXAMPLE_NAME,
    description: ROLE_SWAGGER.NAME_FIELD_DESCRIPTION,
    maxLength: ROLE_NAME_MAX_LENGTH,
  })
  @IsString({ message: ROLE_VALIDATION.NAME_STRING })
  @IsNotEmpty({ message: ROLE_VALIDATION.NAME_REQUIRED })
  @MaxLength(ROLE_NAME_MAX_LENGTH, { message: ROLE_VALIDATION.NAME_MAX_LENGTH })
  name: string;

  @ApiProperty({
    example: ROLE_SWAGGER.EXAMPLE_DESCRIPTION_ADMIN,
    description: ROLE_SWAGGER.DESCRIPTION_FIELD_DESCRIPTION,
  })
  @IsString({ message: ROLE_VALIDATION.DESCRIPTION_STRING })
  @IsNotEmpty({ message: ROLE_VALIDATION.DESCRIPTION_REQUIRED })
  description: string;
}
