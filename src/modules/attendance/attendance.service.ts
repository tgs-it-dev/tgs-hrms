import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Attendance } from '../../entities/attendance.entity';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(Attendance)
    private readonly attendanceRepo: Repository<Attendance>,
  ) {}

  async create(userId: string, dto: CreateAttendanceDto) {
    const attendance = this.attendanceRepo.create({
      type: dto.type,
      user_id: userId,
      timestamp: new Date(), // Server UTC time
    });

    return this.attendanceRepo.save(attendance);
  }

  async findAll(userId?: string) {
    const query = this.attendanceRepo.createQueryBuilder('attendance');

    if (userId) {
      query.where('attendance.user_id = :userId', { userId });
    }

    query.orderBy('attendance.timestamp', 'ASC');
    const records = await query.getMany();

    const groupedByDate: Record<string, { checkIn?: Attendance; checkOut?: Attendance }> = {};

    for (const record of records) {
      const date = record.timestamp.toISOString().split('T')[0];

      if (!groupedByDate[date]) {
        groupedByDate[date] = {};
      }

      if (record.type === 'check-in' && !groupedByDate[date].checkIn) {
        groupedByDate[date].checkIn = record;
      } else if (record.type === 'check-out' && !groupedByDate[date].checkOut) {
        groupedByDate[date].checkOut = record;
      }
    }

    const response = Object.entries(groupedByDate).map(([date, { checkIn, checkOut }]) => {
      let workedHours = 0;

      if (checkIn && checkOut) {
        const diffMs = new Date(checkOut.timestamp).getTime() - new Date(checkIn.timestamp).getTime();
        workedHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
      }

      return {
        date,
        checkIn: checkIn?.timestamp || null,
        checkOut: checkOut?.timestamp || null,
        workedHours,
      };
    });

    return response;
  }

  async update(id: string, dto: UpdateAttendanceDto) {
    const attendance = await this.attendanceRepo.findOne({ where: { id } });
    if (!attendance) throw new NotFoundException('Attendance not found');
    Object.assign(attendance, dto);
    return this.attendanceRepo.save(attendance);
  }

  async remove(id: string) {
    const attendance = await this.attendanceRepo.findOne({ where: { id } });
    if (!attendance) throw new NotFoundException('Attendance not found');
    return this.attendanceRepo.remove(attendance);
  }

async getAllAttendance(tenantId: string) {
  return this.attendanceRepo.find({
    where: { user: { tenant_id: tenantId } },
    relations: ['user'],
  });
}

}
