import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { UserGender } from '../../../common/constants/enums';

export class CreateEmployeeDto {
  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '03123456789' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({
    example: 'securePassword123',
    required: false,
    description: 'Optional. If not provided, a temporary password will be generated',
  })
  @IsString()
  @IsOptional()
  password?: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  @IsNotEmpty()
  first_name: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  last_name: string;

  @ApiProperty({ example: 'uuid-of-designation' })
  @IsUUID()
  @IsNotEmpty()
  designation_id: string;

  @ApiProperty({
    example: 'uuid-of-team',
    required: false,
    nullable: true,
    description: 'Optional. Team ID to assign the employee to during creation',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'string') {
      const v = value.trim();
      if (v === '' || v.toLowerCase() === 'null' || v.toLowerCase() === 'undefined') return undefined;
      return v;
    }
    return value;
  })
  @IsUUID()
  team_id?: string;

  @ApiProperty({
    example: 'admin',
    required: false,
    nullable: true,
    description: 'Optional. Role name to assign to the employee. If not provided, defaults to Employee role.',
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
  @IsString()
  role_name?: string;

  @ApiProperty({
    example: 'uuid-of-role',
    required: false,
    nullable: true,
    description: 'Optional. Role ID to assign to the employee during invite. If not provided, defaults to Employee or Manager as before.',
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

  @ApiProperty({ enum: UserGender, required: false })
  @IsOptional()
  @IsEnum(UserGender)
  gender?: UserGender;
}
