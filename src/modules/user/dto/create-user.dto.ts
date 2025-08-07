import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength, IsUUID } from 'class-validator';

export class CreateUserDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  first_name: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  last_name: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @MinLength(6)
  password: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  

  @ApiProperty()
  @IsUUID()  
  role_id: string; 
}
