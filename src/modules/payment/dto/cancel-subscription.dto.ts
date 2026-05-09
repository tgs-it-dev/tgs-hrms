import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CancelSubscriptionDto {
  @IsString()
  @IsOptional()
  @MaxLength(128)
  reason?: string;
}
