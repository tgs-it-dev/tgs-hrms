import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class UpdateUserRoleDto {
  @ApiProperty({
    example: 'uuid-of-role',
    description: 'Role ID to assign to the user',
  })
  @IsNotEmpty()
  @IsUUID()
  role_id?: string | null;
}
