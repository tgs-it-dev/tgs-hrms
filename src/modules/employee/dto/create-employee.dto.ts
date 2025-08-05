import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, IsNotEmpty } from 'class-validator';

export class CreateEmployeeDto {
  @ApiProperty({ 
    description: 'User UUID to be assigned as employee',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  @IsUUID('4', { message: 'userId must be a valid UUID' })
  @IsNotEmpty({ message: 'userId is required' })
  user_id: string;

  @ApiProperty({ 
    description: 'Designation UUID for the employee',
    example: '6b99992a-d8ef-4c0c-91dc-2a23e391ac9c'
  })
  @IsUUID('4', { message: 'designationId must be a valid UUID' })
  @IsNotEmpty({ message: 'designationId is required' })
  designation_id: string;
}
