import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class PaymentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  signupSessionId: string;

  @ApiProperty({ enum: ['checkout', 'payment_intent'] })
  @IsEnum(['checkout', 'payment_intent'] as any)
  mode: 'checkout' | 'payment_intent';
}
