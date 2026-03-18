import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
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

export class CreateAnnouncementDto {
  @ApiProperty({
    example: 'Office Closed for Eid Holiday',
    description: 'Title of the announcement',
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(200)
  title: string;

  @ApiProperty({
    example: 'The office will remain closed on Monday and Tuesday for Eid celebrations. Enjoy the holidays!',
    description: 'Full content/body of the announcement',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  content: string;

  @ApiPropertyOptional({
    enum: AnnouncementCategory,
    example: AnnouncementCategory.HOLIDAY,
    description: 'Category of the announcement',
    default: AnnouncementCategory.GENERAL,
  })
  @IsOptional()
  @IsEnum(AnnouncementCategory)
  category?: AnnouncementCategory;

  @ApiPropertyOptional({
    enum: AnnouncementPriority,
    example: AnnouncementPriority.HIGH,
    description: 'Priority level of the announcement',
    default: AnnouncementPriority.MEDIUM,
  })
  @IsOptional()
  @IsEnum(AnnouncementPriority)
  priority?: AnnouncementPriority;

  @ApiPropertyOptional({
    example: '2025-02-01T09:00:00.000Z',
    description: 'Schedule date/time to send. If null, sends immediately when published.',
  })
  @IsOptional()
  @IsDateString()
  scheduled_at?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'If true, sends the announcement immediately. If false, saves as draft.',
    default: false,
  })
  @IsOptional()
  send_now?: boolean;
}
