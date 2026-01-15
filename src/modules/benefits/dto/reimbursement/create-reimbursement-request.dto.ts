import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID, IsNumber, IsString, Min, Max } from 'class-validator';

export class CreateReimbursementRequestDto {
  @ApiProperty({
    example: 'employee_benefit_123_uuid',
    description: 'Employee Benefit ID (the benefit assignment)',
  })
  @IsNotEmpty()
  @IsUUID()
  employeeBenefitId: string;

  @ApiProperty({
    example: 5000.00,
    description: 'Reimbursement amount',
  })
  @IsNotEmpty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999.99)
  amount: number;

  @ApiProperty({
    example: 'Health insurance premium paid personally for Q1 2025',
    description: 'Details about the reimbursement request',
  })
  @IsNotEmpty()
  @IsString()
  details: string;
}
