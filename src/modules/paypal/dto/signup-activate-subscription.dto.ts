import { IsString, IsNotEmpty } from 'class-validator';

export class SignupActivateSubscriptionDto {
  @IsString()
  @IsNotEmpty()
  signupSessionId: string;

  @IsString()
  @IsNotEmpty()
  subscriptionId: string;
}
