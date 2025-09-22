import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID, IsEnum } from 'class-validator';

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
    description: 'Optional. Team ID to assign the employee to during creation',
  })
  @IsOptional()
  @IsUUID()
  team_id?: string;

  @ApiProperty({ enum: ['male', 'female'], required: false })
  @IsOptional()
  @IsEnum(['male', 'female'])
  gender?: 'male' | 'female';
}
