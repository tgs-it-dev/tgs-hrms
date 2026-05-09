import { IsString, IsUUID, IsOptional } from 'class-validator';

export class CreateSubscriptionDto {
  @IsUUID()
  signupSessionId: string;

  @IsString()
  @IsOptional()
  planId?: string;
}

export class CreateSubscriptionResponseDto {
  subscriptionId: string;
  approvalUrl: string;
  status: string;
  provider: 'paypal';
}
