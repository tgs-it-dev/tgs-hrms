import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

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
}
