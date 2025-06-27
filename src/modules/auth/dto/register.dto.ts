import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty()
  email: string;

  @ApiProperty()
  password: string;

  @ApiProperty()
  tenantId: number;

  @ApiProperty({ enum: ['admin', 'staff'] })
  role: 'admin' | 'staff';
}
