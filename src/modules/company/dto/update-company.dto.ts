import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class UpdateCompanyDto {
  @ApiProperty({
    description: 'Company name',
    example: 'Tech Solutions Inc'
  })
  @IsString()
  @IsNotEmpty()
  company_name: string;

  @ApiProperty({
    description: 'Company domain',
    example: 'techsolutions.com'
  })
  @IsString()
  @IsNotEmpty()
  domain: string;

  @ApiProperty({
    description: 'Company logo URL',
    example: 'https://example.com/logo.png',
    required: false
  })
  @IsString()
  @IsOptional()
  logo_url?: string;
}
