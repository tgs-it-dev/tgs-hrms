import { IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApproveCheckInDto {
  @ApiPropertyOptional({ 
    description: 'Optional remarks for the approval/rejection',
    example: 'Approved - Checked in on time'
  })
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class BulkApproveCheckInDto {
  @ApiPropertyOptional({ 
    description: 'Optional remarks for bulk approval',
    example: 'All check-ins approved'
  })
  @IsOptional()
  @IsString()
  remarks?: string;
}