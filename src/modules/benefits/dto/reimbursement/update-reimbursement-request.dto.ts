import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsNumber, IsString, Min, Max } from 'class-validator';

export class UpdateReimbursementRequestDto {
  @ApiProperty({
    example: 5500.00,
    description: 'Updated reimbursement amount',
    required: false,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999.99)
  amount?: number;

  @ApiProperty({
    example: 'Updated details about the reimbursement request',
    description: 'Updated details',
    required: false,
  })
  @IsOptional()
  @IsString()
  details?: string;
}
