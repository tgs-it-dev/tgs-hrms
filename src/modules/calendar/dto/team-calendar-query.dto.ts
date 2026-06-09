import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

@ValidatorConstraint({ name: 'DateRangeValid', async: false })
class DateRangeConstraint implements ValidatorConstraintInterface {
  validate(to: string, args: ValidationArguments): boolean {
    const dto = args.object as TeamCalendarQueryDto;
    if (!dto.from || !to) return true;
    return new Date(to) >= new Date(dto.from);
  }
  defaultMessage(): string {
    return '"to" must be on or after "from"';
  }
}

export class TeamCalendarQueryDto {
  @ApiProperty({
    example: '2025-06-01',
    description: 'Start of date range (inclusive)',
  })
  @IsDateString()
  from: string;

  @ApiProperty({
    example: '2025-06-30',
    description: 'End of date range (inclusive)',
  })
  @IsDateString()
  @Validate(DateRangeConstraint)
  to: string;

  @ApiPropertyOptional({
    description: 'Filter to a specific team. Omit for all org members.',
  })
  @IsOptional()
  @IsUUID()
  teamId?: string;

  @ApiPropertyOptional({
    description:
      'Target tenant UUID. Required when the caller is a system-admin; ignored for all other roles.',
  })
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @ApiPropertyOptional({
    example: 'Asia/Karachi',
    description:
      'IANA timezone for attendance date grouping and WORK_LATE detection. ' +
      'Falls back to the X-Timezone request header, then UTC.',
  })
  @IsOptional()
  @IsString()
  timezone?: string;
}
