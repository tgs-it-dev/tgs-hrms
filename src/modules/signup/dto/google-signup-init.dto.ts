import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleSignupInitDto {
  @ApiProperty({ description: 'Google ID token from client-side Google Sign-In' })
  @IsString()
  @IsNotEmpty()
  idToken: string;
}

export interface GoogleSignupInitResponse {
  signupSessionId: string;
  email: string;
  first_name: string;
  last_name: string;
  suggested: {
    companyName: string;
    domain: string;
  };
}


