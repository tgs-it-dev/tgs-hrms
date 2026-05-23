import { ApiProperty } from '@nestjs/swagger';
import {
  IsIP,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class AddIpDto {
  @ApiProperty({
    description:
      'IPv4 or IPv6 address to whitelist (supports both IPv4 and IPv6)',
    example: '192.168.1.100',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsNotEmpty({ message: 'ip_address must not be empty' })
  @IsIP(undefined, {
    message: 'ip_address must be a valid IPv4 or IPv6 address',
  })
  ip_address!: string;

  @ApiProperty({
    description:
      'Optional label to identify this IP (e.g., office network, VPN)',
    example: 'Main office network',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
