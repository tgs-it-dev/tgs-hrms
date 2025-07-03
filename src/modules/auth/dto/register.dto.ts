import { ApiProperty } from '@nestjs/swagger';  
import { IsEmail, IsNotEmpty, IsString, IsUUID, IsEnum, IsNumber } from 'class-validator';  

export class RegisterDto {  
  @ApiProperty()  
  @IsEmail()  
  email: string;  

  @ApiProperty()  
  @IsString()  
  @IsNotEmpty()  
  password: string;  

  @ApiProperty()  
  @IsNumber()  
  @IsNotEmpty()  
  tenantId: number;  

  @ApiProperty({ enum: ['admin', 'staff'] })  
  @IsEnum(['admin', 'staff'])  
  role: 'admin' | 'staff';  

  @ApiProperty()  
  @IsString()  
  @IsNotEmpty()  
  name: string;  

  @ApiProperty()  
  @IsUUID()  
  @IsNotEmpty()  
  companyId: string;  
}  
