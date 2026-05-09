import { IsString, IsUUID, IsNotEmpty } from 'class-validator';

export class CaptureAddonOrderDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsUUID()
  purchaseId: string;
}

export class CaptureAddonOrderResponseDto {
  captureId: string;
  status: string;
  amount: number;
  currency: string;
  employeeCount: number;
}
