import { ApiProperty } from '@nestjs/swagger';

class AttendanceSummaryDto {
  @ApiProperty() date: string;
  @ApiProperty({ nullable: true }) checkIn: Date | null;
  @ApiProperty({ nullable: true }) checkOut: Date | null;
  @ApiProperty() workedHours: number;
}

class LeaveHistoryDto {
  @ApiProperty() id: string;
  @ApiProperty() fromDate: Date;
  @ApiProperty() toDate: Date;
  @ApiProperty() reason: string;
  @ApiProperty() type: string;
  @ApiProperty() status: string;
}

export class EmployeeProfileDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() email: string;
  @ApiProperty() role: string;
  @ApiProperty({ nullable: true }) designation: string | null;
  @ApiProperty({ nullable: true }) department: string | null;
  @ApiProperty() joinedAt: Date;
  @ApiProperty({ type: [AttendanceSummaryDto] }) attendanceSummary: AttendanceSummaryDto[];
  @ApiProperty({ type: [LeaveHistoryDto] }) leaveHistory: LeaveHistoryDto[];
}
