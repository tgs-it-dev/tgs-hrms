import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsEmail,
} from "class-validator";

export class CreateTenantDto {
  @ApiProperty({
    example: "Default Company",
    description: "Tenant name",
  })
  @IsString({ message: "Name must be a string" })
  @IsNotEmpty({ message: "Name is required" })
  @MaxLength(255, { message: "Name cannot exceed 255 characters" })
  name: string;

  @ApiProperty({
    example: "example.com",
    description: "Primary domain associated with the tenant",
  })
  @IsString({ message: "Domain must be a string" })
  @IsNotEmpty({ message: "Domain is required" })
  @MaxLength(255, { message: "Domain cannot exceed 255 characters" })
  domain: string;

  @ApiPropertyOptional({
    example: "https://example.com/logo.png",
    description: "Company logo URL",
  })
  @IsOptional()
  @IsString({ message: "Logo must be a string URL" })
  @MaxLength(500, { message: "Logo URL cannot exceed 500 characters" })
  logo?: string;

  @ApiProperty({
    example: "Alice Tenant",
    description: "Full name of the tenant administrator",
  })
  @IsString({ message: "Admin name must be a string" })
  @IsNotEmpty({ message: "Admin name is required" })
  @MaxLength(255, { message: "Admin name cannot exceed 255 characters" })
  adminName: string;

  @ApiProperty({
    example: "admin@example.com",
    description: "Email for the tenant administrator login",
  })
  @IsEmail({}, { message: "Admin email must be a valid email" })
  @MaxLength(255, { message: "Admin email cannot exceed 255 characters" })
  adminEmail: string;
}
