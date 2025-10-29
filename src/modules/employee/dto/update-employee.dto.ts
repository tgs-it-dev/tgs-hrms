import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateEmployeeDto {
  @ApiPropertyOptional({ example: 'john.doe@example.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: '03123456789' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'SecurePassword#2025' })
  @IsString()
  @IsOptional()
  password?: string;

  @ApiPropertyOptional({ example: 'John' })
  @IsString()
  @IsOptional()
  first_name?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsString()
  @IsOptional()
  last_name?: string;

  @ApiPropertyOptional({ example: 'uuid-of-designation' })
  @IsUUID()
  @IsOptional()
  designation_id?: string;

  @ApiPropertyOptional({
    example: 'uuid-of-team',
    description: 'Team ID to assign the employee to. Set to null to remove from team.',
  })
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'string') {
      const v = value.trim();
      if (v === '' || v.toLowerCase() === 'null' || v.toLowerCase() === 'undefined') return undefined;
      return v;
    }
    return value;
  })
  @IsUUID()
  @IsOptional()
  team_id?: string;

  @ApiPropertyOptional({
    example: 'uuid-of-role',
    description: 'Optional. Role ID to assign to the employee. If not provided, role will not be changed.',
  })
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'string') {
      const v = value.trim();
      if (v === '' || v.toLowerCase() === 'null' || v.toLowerCase() === 'undefined') return undefined;
      return v;
    }
    return value;
  })
  @IsOptional()
  @IsUUID()
  role_id?: string;

  @ApiPropertyOptional({ 
    example: '12345-1234567-1',
    description: 'CNIC number in format: XXXXX-XXXXXXX-X'
  })
  @IsOptional()
  @IsString()
  cnic_number?: string;
}
