import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from 'src/entities/employee.entity';
import { Attendance } from 'src/entities/attendance.entity';
import { Leave } from 'src/entities/leave.entity';

@Injectable()
export class EmployeeProfileService {
  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,

    @InjectRepository(Attendance)
    private readonly attendanceRepo: Repository<Attendance>,

    @InjectRepository(Leave)
    private readonly leaveRepo: Repository<Leave>,
  ) {}

  async getEmployeeProfile(employeeId: string) {
    // Fetch employee with related entities
    const employee = await this.employeeRepo.findOne({
  where: { id: employeeId },
  relations: ['user', 'designation', 'designation.department', 'user.role'],
});

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const userId = employee.user.id;

    // Attendance history grouped by date
    const attendanceRecords = await this.attendanceRepo.find({
      where: { user_id: userId },
      order: { timestamp: 'ASC' },
    });

    const groupedAttendance = this.groupAttendanceByDate(attendanceRecords);

    // Leave history
    const leaveHistory = await this.leaveRepo.find({
      where: { user_id: userId },
      order: { from_date: 'DESC' },
    });

    return {
      id: employee.id,
      first_name: employee.user.first_name,
      last_name: employee.user.first_name,
      email: employee.user.email,
      role: employee.user.role.name,
      designation: employee.designation?.title || null,
      department: employee.designation?.department?.name || null,
      joinedAt: employee.created_at,
      attendanceSummary: groupedAttendance,
      leaveHistory,
    };
  }

  private groupAttendanceByDate(records: Attendance[]) {
    const grouped: Record<string, { checkIn?: Date; checkOut?: Date; workedHours: number }> = {};

    for (const record of records) {
      const date = record.timestamp.toISOString().split('T')[0];
      if (!grouped[date]) {
        grouped[date] = { workedHours: 0 };
      }

      if (record.type === 'check-in') {
        grouped[date].checkIn = record.timestamp;
      } else if (record.type === 'check-out') {
        grouped[date].checkOut = record.timestamp;
      }

      if (grouped[date].checkIn && grouped[date].checkOut) {
        const diffMs =
          new Date(grouped[date].checkOut!).getTime() -
          new Date(grouped[date].checkIn!).getTime();
        grouped[date].workedHours = Math.round(diffMs / (1000 * 60 * 60) * 100) / 100;
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
