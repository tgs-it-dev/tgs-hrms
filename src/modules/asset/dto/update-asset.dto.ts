import { PartialType } from '@nestjs/swagger';
import { CreateAssetDto } from './create-asset.dto';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateAssetDto extends PartialType(CreateAssetDto) {
  @IsOptional()
  @IsIn(['available', 'assigned', 'under_maintenance', 'retired'])
  status?: string;

  @IsOptional()
  @IsString()
  assignedTo?: string | null;
}


