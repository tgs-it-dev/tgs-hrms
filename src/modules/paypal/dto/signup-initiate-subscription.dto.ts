import { IsUUID, IsString, IsNotEmpty } from 'class-validator';

export class SignupInitiateSubscriptionDto {
  @IsString()
  @IsNotEmpty()
  signupSessionId: string;

  @IsUUID()
  planId: string;
}
