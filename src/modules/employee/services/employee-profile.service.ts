import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from 'src/entities/employee.entity';
import { Attendance } from 'src/entities/attendance.entity';
import { AttendanceType } from '../../../common/constants/enums';
import { Leave } from 'src/entities/leave.entity';

@Injectable()
export class EmployeeProfileService {
  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,

    @InjectRepository(Attendance)
    private readonly attendanceRepo: Repository<Attendance>,

    @InjectRepository(Leave)
    private readonly leaveRepo: Repository<Leave>
  ) {}

  async getEmployeeProfileByUserId(userId: string) {
    // Fetch employee record by user_id with related entities
    const employee = await this.employeeRepo.findOne({
      where: { user_id: userId },
      relations: ['user', 'designation', 'designation.department', 'user.role'],
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const effectiveUserId = employee.user.id;

    // Attendance history grouped by date
    const attendanceRecords = await this.attendanceRepo.find({
      where: { user_id: effectiveUserId },
      order: { timestamp: 'ASC' },
    });

    const groupedAttendance = this.groupAttendanceByDate(attendanceRecords);

    // Leave history
    const leaveHistory = await this.leaveRepo.find({
      where: { employeeId: effectiveUserId },
      order: { startDate: 'DESC' },
      relations: ['leaveType'],
    });

    return {
      id: employee.user.id,
      name: [employee.user.first_name, employee.user.last_name].filter(Boolean).join(' ').trim(),
      email: employee.user.email,
      role: employee.user.role.name,
      designation: employee.designation?.title || null,
      department: employee.designation?.department?.name || null,
      joinedAt: employee.created_at,
      attendanceSummary: groupedAttendance,
      profile_pic: employee.user.profile_pic,
      leaveHistory: leaveHistory.map((leave) => ({
        id: leave.id,
        fromDate: leave.startDate,
        toDate: leave.endDate,
        reason: leave.reason,
        type: leave.leaveType?.name || 'Unknown',
        status: leave.status,
      })),
    };
  }

  private groupAttendanceByDate(records: Attendance[]) {
    const grouped: Record<string, { checkIn?: Date; checkOut?: Date; workedHours: number }> = {};

    for (const record of records) {
      const date = record.timestamp.toISOString().split('T')[0];
      if (!date) continue;
      if (!grouped[date]) {
        grouped[date] = { workedHours: 0 };
      }

      if (record.type === AttendanceType.CHECK_IN) {
        grouped[date].checkIn = record.timestamp;
      } else if (record.type === AttendanceType.CHECK_OUT) {
        grouped[date].checkOut = record.timestamp;
      }

      const dayData = grouped[date];
      if (dayData && dayData.checkIn && dayData.checkOut) {
        const diffMs =
          new Date(dayData.checkOut).getTime() - new Date(dayData.checkIn).getTime();
        dayData.workedHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
      }
    }

    return Object.entries(grouped).map(([date, { checkIn, checkOut, workedHours }]) => ({
      date,
      checkIn: checkIn || null,
      checkOut: checkOut || null,
      workedHours,
    }));
  }
}
