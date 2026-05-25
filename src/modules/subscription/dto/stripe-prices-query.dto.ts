import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class StripePricesQueryDto {
  @ApiProperty({
    description: 'Comma-separated list of Stripe price IDs',
    example: 'price_abc123,price_def456',
  })
  @IsString()
  @IsNotEmpty()
  ids: string;
}
