import {
  IsDateString,
  IsOptional,
  IsTimeZone,
  IsUUID,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Hard cap: prevents generate_series × employees from becoming unbounded.
const MAX_RANGE_DAYS = 366;

@ValidatorConstraint({ name: 'DateRangeValid', async: false })
class DateRangeConstraint implements ValidatorConstraintInterface {
  validate(to: string, args: ValidationArguments): boolean {
    const dto = args.object as TeamCalendarQueryDto;
    if (!dto.from || !to) return true;
    const fromMs = new Date(dto.from).getTime();
    const toMs = new Date(to).getTime();
    if (toMs < fromMs) return false;
    return (toMs - fromMs) / 86_400_000 <= MAX_RANGE_DAYS;
  }

  defaultMessage(args: ValidationArguments): string {
    const dto = args.object as TeamCalendarQueryDto;
    if (!dto.from || !args.value) return '"to" must be on or after "from"';
    const fromMs = new Date(dto.from).getTime();
    const toMs = new Date(args.value as string).getTime();
    if (toMs < fromMs) return '"to" must be on or after "from"';
    return `Date range cannot exceed ${MAX_RANGE_DAYS} days`;
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
    description: `End of date range (inclusive). Must be ≥ from and within ${MAX_RANGE_DAYS} days.`,
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
  @IsTimeZone()
  timezone?: string;
}
