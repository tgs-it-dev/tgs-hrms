import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, IsEmail, IsNotEmpty } from 'class-validator';

export class CreateEmployeeDto {
  @ApiProperty({ example: 'John Doe', description: 'Employee full name' })
  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Name is required' })
  name: string;

  @ApiProperty({ example: 'john.doe@company.com', description: 'Employee email address' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiPropertyOptional({ example: '+1234567890', description: 'Employee phone number' })
  @IsString({ message: 'Phone must be a string' })
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ description: 'Department UUID' })
  @IsUUID('4', { message: 'departmentId must be a valid UUID' })
  @IsOptional()
  departmentId?: string;

  @ApiPropertyOptional({ description: 'Designation UUID' })
  @IsUUID('4', { message: 'designationId must be a valid UUID' })
  @IsOptional()
  designationId?: string;
}
