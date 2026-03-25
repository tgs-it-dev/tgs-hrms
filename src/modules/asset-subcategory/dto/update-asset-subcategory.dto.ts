import { PartialType } from '@nestjs/swagger';
import { CreateAssetSubcategoryDto } from './create-asset-subcategory.dto';

export class UpdateAssetSubcategoryDto extends PartialType(CreateAssetSubcategoryDto) {}
