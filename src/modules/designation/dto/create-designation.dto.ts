import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDesignationDto {
  @ApiProperty({ example: 'Manager', description: 'Designation title' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  title: string;

  @ApiProperty({
    example: 'Manages team and tasks',
    required: false,
    description: 'Description of the designation',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: '6b99992a-d8ef-4c0c-91dc-2a23e391ac9c', description: 'Related department ID' })
  @IsNotEmpty()
  @IsUUID()
  departmentId: string;
}
