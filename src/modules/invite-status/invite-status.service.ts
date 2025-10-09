import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from '../../entities/employee.entity';
import { InviteStatus } from '../../common/constants/enums';
import { User } from '../../entities/user.entity';

@Injectable()
export class InviteStatusService {
  private readonly logger = new Logger(InviteStatusService.name);

  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}


  async updateInviteStatusOnLogin(userId: string): Promise<void> {
    try {
      const employee = await this.employeeRepo.findOne({
        where: { user_id: userId },
        relations: ['user'],
      });

      if (!employee) {
        this.logger.warn(`No employee found for user ID: ${userId}`);
        return;
      }

      
      if (employee.invite_status === InviteStatus.INVITE_SENT) {
        employee.invite_status = InviteStatus.JOINED;
        await this.employeeRepo.save(employee);
        this.logger.log(`Updated invite status to 'Joined' for employee: ${employee.id}`);
      }
    } catch (error) {
      this.logger.error(`Failed to update invite status for user ${userId}: ${error.message}`);
    }
  }

 
  async checkAndUpdateExpiredInvites(tenantId?: string): Promise<number> {
    try {
      const queryBuilder = this.employeeRepo
        .createQueryBuilder('employee')
        .leftJoinAndSelect('employee.user', 'user')
        .where('employee.invite_status = :status', { status: InviteStatus.INVITE_SENT })
        .andWhere('user.first_login_time IS NULL')
        .andWhere('employee.created_at < :expiryTime', { 
          expiryTime: new Date(Date.now() - 24 * 60 * 60 * 1000) 
        });

      if (tenantId) {
        queryBuilder.andWhere('user.tenant_id = :tenantId', { tenantId });
      }

      const expiredEmployees = await queryBuilder.getMany();
      
      if (expiredEmployees.length === 0) {
        return 0;
      }

    
      const updateResult = await this.employeeRepo
        .createQueryBuilder()
        .update(Employee)
        .set({ invite_status: InviteStatus.INVITE_EXPIRED })
        .where('id IN (:...ids)', { ids: expiredEmployees.map(emp => emp.id) })
        .execute();

      this.logger.log(`Updated ${updateResult.affected} expired invites to 'Invite Expired'`);
      return updateResult.affected || 0;
    } catch (error) {
      this.logger.error(`Failed to check and update expired invites: ${error.message}`);
      return 0;
    }
  }

  
  async getInviteStatus(employeeId: string): Promise<string | null> {
    try {
      const employee = await this.employeeRepo.findOne({
        where: { id: employeeId },
        relations: ['user'],
      });

      if (!employee) {
        return null;
      }

    
      if (employee.invite_status === InviteStatus.INVITE_SENT && 
          !employee.user.first_login_time &&
          employee.created_at < new Date(Date.now() - 24 * 60 * 60 * 1000)) {
        
      
        employee.invite_status = InviteStatus.INVITE_EXPIRED;
        await this.employeeRepo.save(employee);
        return InviteStatus.INVITE_EXPIRED;
      }

      return employee.invite_status;
    } catch (error) {
      this.logger.error(`Failed to get invite status for employee ${employeeId}: ${error.message}`);
      return null;
    }
  }

  async setInviteStatus(employeeId: string, status: InviteStatus): Promise<boolean> {
    try {
      const updateResult = await this.employeeRepo.update(employeeId, { invite_status: status });
      this.logger.log(`Manually set invite status to '${status}' for employee: ${employeeId}`);
      return (updateResult.affected || 0) > 0;
    } catch (error) {
      this.logger.error(`Failed to set invite status for employee ${employeeId}: ${error.message}`);
      return false;
    }
  }
}
