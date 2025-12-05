import { PartialType } from '@nestjs/swagger';
import { CreateAssetDto } from './create-asset.dto';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { AssetStatus } from '../../../common/constants/enums';

export class UpdateAssetDto extends PartialType(CreateAssetDto) {
  @IsOptional()
  @IsEnum(AssetStatus)
  status?: AssetStatus;

  @IsOptional()
  @IsUUID()
  assignedTo?: string | null;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  subcategoryId?: string;
}


