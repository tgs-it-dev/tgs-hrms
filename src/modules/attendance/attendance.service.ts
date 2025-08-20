import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Attendance } from '../../entities/attendance.entity';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { TimesheetService } from '../timesheet/timesheet.service'; 

@Injectable()
export class AttendanceService {
	constructor(
		@InjectRepository(Attendance)
		private readonly attendanceRepo: Repository<Attendance>,
		   private readonly timesheetService: TimesheetService, 
	) {}
	async create(userId: string, dto: CreateAttendanceDto) {
		const now = new Date();
		const attendance = this.attendanceRepo.create({
			type: dto.type,
			user_id: userId,
			timestamp: now,
		});
		const saved = await this.attendanceRepo.save(attendance);
		
  if (dto.type === 'check-out') {
    await this.timesheetService.autoEndIfActive(userId);
  }

		return saved;
	}
	
	async findAll(userId?: string, page: number = 1) {
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
		
			if (record.type === 'check-in') {
				groupedByDate[date].checkIn = record;
			} else if (record.type === 'check-out') {
				groupedByDate[date].checkOut = record;
			}
		}
		const response = Object.entries(groupedByDate).map(([date, { checkIn, checkOut }]) => {
			let workedHours = 0;
			
			if (checkIn && checkOut && new Date(checkOut.timestamp) > new Date(checkIn.timestamp)) {
				const diffMs = new Date(checkOut.timestamp).getTime() - new Date(checkIn.timestamp).getTime();
				workedHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
			}
			return {
				date,
				checkIn: checkIn?.timestamp || null,
				checkOut: checkOut && checkIn && new Date(checkOut.timestamp) > new Date(checkIn.timestamp)
					? checkOut.timestamp
					: null,
				workedHours,
			};
		});
		const limit = 25;
		const start = (page - 1) * limit;
		return response.slice(start, start + limit);
	}
	
	async findEvents(userId?: string, page: number = 1) {
		const qb = this.attendanceRepo.createQueryBuilder('attendance')
			.leftJoinAndSelect('attendance.user', 'user')
			.orderBy('attendance.timestamp', 'DESC');
		if (userId) {
			qb.where('attendance.user_id = :userId', { userId });
		}
		const limit = 25;
		const skip = (page - 1) * limit;
		return qb.skip(skip).take(limit).getMany();
	}
	
	async getTodaySummary(userId: string) {
		const now = new Date();
		const startOfDayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
		const startOfNextDayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
		const latestCheckIn = await this.attendanceRepo.createQueryBuilder('a')
			.where('a.user_id = :userId', { userId })
			.andWhere('a.type = :type', { type: 'check-in' })
			.andWhere('a.timestamp >= :startOfDayUtc AND a.timestamp < :startOfNextDayUtc', {
				startOfDayUtc, startOfNextDayUtc,
			})
			.orderBy('a.timestamp', 'DESC')
			.getOne();
		let matchingCheckOut: Attendance | null = null;
		if (latestCheckIn) {
			matchingCheckOut = await this.attendanceRepo.createQueryBuilder('a')
				.where('a.user_id = :userId', { userId })
				.andWhere('a.type = :type', { type: 'check-out' })
				.andWhere('a.timestamp > :after', { after: latestCheckIn.timestamp })
				.andWhere('a.timestamp < :startOfNextDayUtc', { startOfNextDayUtc })
				.orderBy('a.timestamp', 'DESC')
				.getOne();
		}
		return {
			checkIn: latestCheckIn?.timestamp || null,
			checkOut: matchingCheckOut?.timestamp || null,
		};
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
	async getAllAttendance(tenantId: string, page: number = 1) {
		const limit = 25;
		const skip = (page - 1) * limit;
		return this.attendanceRepo.find({
			where: { user: { tenant_id: tenantId } },
			relations: ['user'],
			skip,
			take: limit,
		});
	}
}





