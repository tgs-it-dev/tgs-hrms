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
		const now = new Date();
		const attendance = this.attendanceRepo.create({
			type: dto.type,
			user_id: userId,
			timestamp: now,
		});
		const saved = await this.attendanceRepo.save(attendance);
		return saved;
	}
	// Daily summary: one row per day (latest check-in/out of that day)
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
			// Latest per type wins
			if (record.type === 'check-in') {
				groupedByDate[date].checkIn = record;
			} else if (record.type === 'check-out') {
				groupedByDate[date].checkOut = record;
			}
		}
		const response = Object.entries(groupedByDate).map(([date, { checkIn, checkOut }]) => {
			let workedHours = 0;
			// Only count hours if checkout is after checkin
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
		return response;
	}
	// Raw events list for building multiple sessions per day in UI
	async findEvents(userId?: string) {
		const qb = this.attendanceRepo.createQueryBuilder('attendance')
			.leftJoinAndSelect('attendance.user', 'user')
			.orderBy('attendance.timestamp', 'DESC');
		if (userId) {
			qb.where('attendance.user_id = :userId', { userId });
		}
		return qb.getMany();
	}
	// Return check-in and its matching checkout (checkout must be after latest check-in)
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
	async getAllAttendance(tenantId: string) {
		return this.attendanceRepo.find({
			where: { user: { tenant_id: tenantId } },
			relations: ['user'],
		});
	}
}