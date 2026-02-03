import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  AnnouncementCategory,
  AnnouncementPriority,
} from '../../../common/constants/enums';

export class UpdateAnnouncementDto {
  @ApiPropertyOptional({
    example: 'Updated: Office Closed for Eid Holiday',
    description: 'Title of the announcement',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({
    example: 'The office will remain closed for the entire week.',
    description: 'Full content/body of the announcement',
  })
  @IsOptional()
  @IsString()
  @MinLength(10)
  content?: string;

  @ApiPropertyOptional({
    enum: AnnouncementCategory,
    example: AnnouncementCategory.HOLIDAY,
    description: 'Category of the announcement',
  })
  @IsOptional()
  @IsEnum(AnnouncementCategory)
  category?: AnnouncementCategory;

  @ApiPropertyOptional({
    enum: AnnouncementPriority,
    example: AnnouncementPriority.HIGH,
    description: 'Priority level of the announcement',
  })
  @IsOptional()
  @IsEnum(AnnouncementPriority)
  priority?: AnnouncementPriority;

  @ApiPropertyOptional({
    example: '2025-02-01T09:00:00.000Z',
    description: 'Schedule date/time to send. Set to null to remove scheduling.',
  })
  @IsOptional()
  @IsDateString()
  scheduled_at?: string | null;
}
