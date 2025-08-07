import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ 
    example: 'admin', 
    description: 'Role name (unique, max 50 characters)',
    maxLength: 50
  })
  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Name is required' })
  @MaxLength(50, { message: 'Name cannot exceed 50 characters' })
  name: string;

  @ApiProperty({ 
    example: 'Administrator with full access', 
    description: 'Role description'
  })
  @IsString({ message: 'Description must be a string' })
  @IsNotEmpty({ message: 'Description is required' })
  description: string;
} 