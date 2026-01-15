import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsIn, IsOptional, IsString } from 'class-validator';
import { BenefitReimbursementStatus } from '../../../../common/constants/enums';

export class ReviewReimbursementRequestDto {
  @ApiProperty({
    example: 'approved',
    enum: ['approved', 'rejected'],
    description: 'Review decision',
  })
  @IsNotEmpty()
  @IsIn(['approved', 'rejected'])
  status: 'approved' | 'rejected';

  @ApiProperty({
    example: 'Documents verified. Approved for reimbursement.',
    description: 'Review remarks/comments',
    required: false,
  })
  @IsOptional()
  @IsString()
  reviewRemarks?: string;
}
