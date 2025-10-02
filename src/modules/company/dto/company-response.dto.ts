import { ApiProperty } from '@nestjs/swagger';

export class CompanyResponseDto {
  @ApiProperty({
    description: 'Company ID',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  id: string;

  @ApiProperty({
    description: 'Company name',
    example: 'Tech Solutions Inc'
  })
  company_name: string;

  @ApiProperty({
    description: 'Company domain',
    example: 'techsolutions.com'
  })
  domain: string;

  @ApiProperty({
    description: 'Company logo URL',
    example: 'https://example.com/logo.png',
    nullable: true
  })
  logo_url: string | null;

  @ApiProperty({
    description: 'Subscription plan ID',
    example: 'plan_premium'
  })
  plan_id: string;

  @ApiProperty({
    description: 'Payment status',
    example: true
  })
  is_paid: boolean;

  @ApiProperty({
    description: 'Tenant ID',
    example: '123e4567-e89b-12d3-a456-426614174001',
    nullable: true
  })
  tenant_id: string | null;

  @ApiProperty({
    description: 'Creation date',
    example: '2024-01-01T00:00:00.000Z'
  })
  created_at: Date;

  @ApiProperty({
    description: 'Last update date',
    example: '2024-01-01T00:00:00.000Z'
  })
  updated_at: Date;
}
