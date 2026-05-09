import { IsInt, IsPositive, Min, Max } from 'class-validator';

export class CreateAddonOrderDto {
  /** Number of additional employee slots to purchase. */
  @IsInt()
  @IsPositive()
  @Min(1)
  @Max(1000)
  employeeCount: number;
}

export class CreateAddonOrderResponseDto {
  orderId: string;
  approvalUrl: string;
  status: string;
  amount: number;
  currency: string;
  purchaseId: string;
}
