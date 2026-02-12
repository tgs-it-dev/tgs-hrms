import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, IsNotEmpty } from 'class-validator';
import { Match } from '../../../common/decorators/match.decorator'; // custom decorator

export class ResetPasswordDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'The password reset token sent to the user email',
  })
  @IsString({ message: 'Token must be a string' })
  @IsNotEmpty({ message: 'Reset token is required' })
  token: string;

  @ApiProperty({
    example: 'StrongPass123!',
    description: 'The new password to set',
    minLength: 6,
  })
  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;

  @ApiProperty({
    example: 'StrongPass123!',
    description: 'Confirm the new password',
  })
  @IsString({ message: 'Confirm password must be a string' })
  @IsNotEmpty({ message: 'Confirm password is required' })
  @Match('password', { message: 'Passwords do not match' })
  confirmPassword: string;
}

/** Body only (token comes from x-reset-token header). */
export class ResetPasswordBodyDto {
  @ApiProperty({
    example: 'StrongPass123!',
    description: 'The new password to set',
    minLength: 6,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;

  @ApiProperty({
    example: 'StrongPass123!',
    description: 'Confirm the new password',
  })
  @IsString()
  @IsNotEmpty()
  @Match('password', { message: 'Passwords do not match' })
  confirmPassword: string;
}
