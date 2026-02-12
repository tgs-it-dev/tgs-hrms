import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from 'src/common/constants';

export class JwtPayloadDto {
  @ApiProperty({ example: 'user@example.com', description: 'User email' })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'b29a0f7c-0c55-4b6c-921a-26f4e62c7f3a',
    description: 'User ID (subject)',
  })
  @IsUUID()
  sub: string;

  @ApiProperty({ example: UserRole.ADMIN, description: 'User role' })
  @IsString()
  @IsNotEmpty()
  role: string;

  @ApiProperty({
    example: '2b821d62-bbbb-4f1e-80a3-44d42d8aab6c',
    description: 'Tenant ID',
  })
  @IsUUID()
  @IsOptional()
  tenant_id?: string;
}

export class JwtUserPayloadDto {
  @ApiProperty({ example: 'user@example.com', description: 'User email' })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'b29a0f7c-0c55-4b6c-921a-26f4e62c7f3a',
    description: 'User ID (subject)',
  })
  @IsUUID()
  id: string;

  @ApiProperty({ example: UserRole.ADMIN, description: 'User role' })
  @IsString()
  @IsNotEmpty()
  role: string;

  @ApiProperty({
    example: '2b821d62-bbbb-4f1e-80a3-44d42d8aab6c',
    description: 'Tenant ID',
  })
  @IsUUID()
  @IsOptional()
  tenant_id?: string;
}
