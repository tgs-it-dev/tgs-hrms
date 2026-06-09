import { IsString, IsNotEmpty } from 'class-validator';

export class ActivateSubscriptionDto {
  @IsString()
  @IsNotEmpty()
  subscriptionId: string;
}
