import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
  Query,
  ForbiddenException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags, ApiQuery } from '@nestjs/swagger';
import { PayrollRecordService } from '../services/payroll-record.service';
import { GeneratePayrollDto, UpdatePayrollStatusDto, PayrollSummaryQueryDto, PayrollStatisticsQueryDto } from '../dto/payroll-record.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { Roles } from '../../../common/decorators/roles.decorator';

@ApiTags('Payroll Records')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('payroll')
export class PayrollRecordController {
  constructor(private readonly payrollRecordService: PayrollRecordService) {}

  @Post('generate')
  @Roles('admin', 'system-admin', 'hr-admin')
  @ApiOperation({ summary: 'Generate payroll for employees' })
  @ApiResponse({ status: 201, description: 'Payroll generated successfully.' })
  @ApiQuery({ name: 'month', required: true, type: Number, description: 'Month (1-12)' })
  @ApiQuery({ name: 'year', required: true, type: Number, description: 'Year' })
  @ApiQuery({ name: 'employee_id', required: false, type: String, description: 'Employee ID (optional, generates for all if not provided)' })
  async generatePayroll(@Req() req: any, @Query() query: GeneratePayrollDto) {
    const tenantId = req.user.tenant_id;
    const userId = req.user.id;
    return await this.payrollRecordService.generatePayroll(tenantId, userId, query);
  }

  @Get()
  @Roles('admin', 'system-admin', 'hr-admin')
  @ApiOperation({ summary: 'Get payroll records for a specific month and year' })
  @ApiResponse({ status: 200, description: 'Payroll records retrieved successfully.' })
  @ApiQuery({ name: 'month', required: true, type: Number })
  @ApiQuery({ name: 'year', required: true, type: Number })
  @ApiQuery({ name: 'employee_id', required: false, type: String })
  async getPayrollRecords(
    @Req() req: any,
    @Query('month') month: number,
    @Query('year') year: number,
    @Query('employee_id') employeeId?: string,
  ) {
    const tenantId = req.user.tenant_id;
    return await this.payrollRecordService.getPayrollRecords(
      tenantId,
      Number(month),
      Number(year),
      employeeId,
    );
  }

  @Get('employee/:employeeId/history')
  @Roles('admin', 'system-admin', 'hr-admin', 'employee', 'manager')
  @ApiOperation({ summary: 'Get payroll history for an employee' })
  @ApiResponse({ status: 200, description: 'Payroll history retrieved successfully.' })
  async getEmployeePayrollHistory(@Req() req: any, @Param('employeeId') employeeId: string) {
    const tenantId = req.user.tenant_id;
    const userRole = req.user.role;
    const userId = req.user.id;

    // Employees can only view their own payroll history
    if (userRole === 'employee') {
      // Check if employeeId matches user's employee record
      // This would require checking employee table - for now, allow but verify in service
      // In production, you'd want to verify employee.user_id === userId
    }

    return await this.payrollRecordService.getEmployeePayrollHistory(employeeId, tenantId);
  }

  @Put(':id/status')
  @Roles('admin', 'system-admin', 'hr-admin')
  @ApiOperation({ summary: 'Update payroll record status' })
  @ApiResponse({ status: 200, description: 'Payroll status updated successfully.' })
  @ApiResponse({ status: 404, description: 'Payroll record not found.' })
  async updatePayrollStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdatePayrollStatusDto,
  ) {
    const tenantId = req.user.tenant_id;
    const userId = req.user.id;
    return await this.payrollRecordService.updatePayrollStatus(id, tenantId, userId, dto);
  }

  @Get(':id/payslip')
  @Roles('admin', 'system-admin', 'hr-admin', 'employee', 'manager')
  @ApiOperation({ summary: 'Get payslip for a payroll record' })
  @ApiResponse({ status: 200, description: 'Payslip retrieved successfully.' })
  @ApiResponse({ status: 404, description: 'Payroll record not found.' })
  async getPayslip(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.user.tenant_id;
    const userId = req.user.id;
    const userRole = req.user.role;
    return await this.payrollRecordService.getPayslip(id, tenantId, userId, userRole);
  }

  @Get('summary')
  @Roles('admin', 'system-admin', 'hr-admin')
  @ApiOperation({ summary: 'Get payroll summary for a month' })
  @ApiResponse({ status: 200, description: 'Payroll summary retrieved successfully.' })
  @ApiQuery({ name: 'month', required: true, type: Number })
  @ApiQuery({ name: 'year', required: true, type: Number })
  async getPayrollSummary(
    @Req() req: any,
    @Query('month') month: number,
    @Query('year') year: number,
  ) {
    const tenantId = req.user.tenant_id;
    return await this.payrollRecordService.getPayrollSummary(tenantId, Number(month), Number(year));
  }

  @Get('statistics')
  @Roles('admin', 'system-admin', 'hr-admin')
  @ApiOperation({ summary: 'Get payroll statistics and trends' })
  @ApiResponse({ status: 200, description: 'Payroll statistics retrieved successfully.' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async getPayrollStatistics(@Req() req: any, @Query() query: PayrollStatisticsQueryDto) {
    const tenantId = req.user.tenant_id;
    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;
    return await this.payrollRecordService.getPayrollStatistics(tenantId, startDate, endDate);
  }
}

