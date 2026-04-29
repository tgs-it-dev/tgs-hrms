import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Employee } from "src/entities/employee.entity";
import { Leave } from "src/entities/leave.entity";
import { EmployeeStatus } from "src/common/constants/enums";

@Injectable()
export class SystemEmployeeService {
  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(Leave)
    private readonly leaveRepo: Repository<Leave>,
  ) {}

  async findAll(
    page: number = 1,
    filters?: {
      tenantId?: string;
      departmentId?: string;
      designationId?: string;
      status?: string;
    },
  ) {
    const qb = this.employeeRepo
      .createQueryBuilder("employee")
      .leftJoinAndSelect("employee.user", "user")
      .leftJoinAndSelect("user.tenant", "tenant")
      .leftJoinAndSelect("employee.designation", "designation")
      .leftJoinAndSelect("designation.department", "department");

    if (filters?.tenantId) {
      qb.andWhere("user.tenant_id = :tenantId", {
        tenantId: filters.tenantId,
      });
    }

    if (filters?.departmentId) {
      qb.andWhere("department.id = :departmentId", {
        departmentId: filters.departmentId,
      });
    }

    if (filters?.designationId) {
      qb.andWhere("designation.id = :designationId", {
        designationId: filters.designationId,
      });
    }

    if (filters?.status) {
      qb.andWhere("employee.status = :status", {
        status: filters.status,
      });
    }

    qb.orderBy("employee.created_at", "DESC");
    qb.skip((page - 1) * 25).take(25);

    const results = await qb.getMany();

    const data = results.map((e) => {
      const isTenantDeleted = !!e.user?.tenant?.deleted_at;
      const isTenantSuspended = e.user?.tenant?.status === "suspended";
      const employeeStatus =
        isTenantDeleted || isTenantSuspended
          ? EmployeeStatus.INACTIVE
          : e.status;

      return {
        id: e.id,
        name: `${e.user.first_name} ${e.user.last_name}`,
        tenantId: e.user.tenant_id,
        departmentId: e.designation?.department?.id,
        departmentName: e.designation?.department?.name,
        designationId: e.designation?.id,
        designationTitle: e.designation?.title,
        status: employeeStatus,
        inviteStatus: e.invite_status,
        createdAt: e.created_at,
      };
    });

    return data;
  }

  async findProfile(id: string) {
    const employee = await this.employeeRepo.findOne({
      where: { id },
      relations: [
        "user",
        "user.tenant",
        "designation",
        "designation.department",
        "team",
      ],
    });

    if (!employee) {
      throw new NotFoundException("Employee not found");
    }

    const isTenantDeleted = !!employee.user?.tenant?.deleted_at;
    const isTenantSuspended = employee.user?.tenant?.status === "suspended";
    const employeeStatus =
      isTenantDeleted || isTenantSuspended
        ? EmployeeStatus.INACTIVE
        : employee.status;

    return {
      id: employee.id,
      name: `${employee.user.first_name} ${employee.user.last_name}`,
      email: employee.user.email,
      tenantId: employee.user.tenant_id,
      departmentId: employee.designation?.department?.id,
      departmentName: employee.designation?.department?.name,
      designationId: employee.designation?.id,
      designationTitle: employee.designation?.title,
      team: employee.team?.name ?? null,
      status: employeeStatus,
      inviteStatus: employee.invite_status,
    };
  }

  async getLeaves(employeeId?: string, userId?: string) {
    let targetUserId: string | undefined;

    if (employeeId) {
      const employee = await this.employeeRepo.findOne({
        where: { id: employeeId },
        relations: ["user"],
      });

      if (!employee) {
        throw new NotFoundException("Employee not found");
      }

      targetUserId = employee.user_id;
    }

    if (userId) {
      targetUserId = userId;
    }

    if (!targetUserId) {
      const leaves = await this.leaveRepo.find({
        order: { createdAt: "DESC" },
        relations: ["leaveType", "approver"],
      });
      return leaves;
    }

    const leaves = await this.leaveRepo.find({
      where: { employeeId: targetUserId },
      order: { createdAt: "DESC" },
      relations: ["leaveType", "approver"],
    });

    return leaves;
  }
}
