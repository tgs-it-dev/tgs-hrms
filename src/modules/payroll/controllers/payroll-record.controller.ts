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
  @Roles('admin', 'hr-admin')
  @ApiOperation({ summary: 'Generate payroll for employees' })
  @ApiResponse({ status: 201, description: 'Payroll generated successfully.' })
  @ApiQuery({ name: 'month', required: true, type: Number, description: 'Month (1-12)' })
  @ApiQuery({ name: 'year', required: true, type: Number, description: 'Year' })
  @ApiQuery({ name: 'employee_id', required: false, type: String, description: 'Employee ID (optional, generates for all if not provided)' })
  async generatePayroll(@Req() req: any, @Query() query: GeneratePayrollDto) {
    const userRole = req.user.role?.toLowerCase();
    if (userRole === 'system-admin') {
      throw new ForbiddenException('System admin cannot generate payroll');
    }
    const tenantId = req.user.tenant_id;
    const userId = req.user.id;
    return await this.payrollRecordService.generatePayroll(tenantId, userId, query);
  }

  @Get()
  @Roles('admin', 'system-admin', 'hr-admin')
  @ApiOperation({ summary: 'Get payroll records for a specific month and year (Paginated)' })
  @ApiResponse({ status: 200, description: 'Payroll records retrieved successfully.' })
  @ApiQuery({ name: 'month', required: true, type: Number })
  @ApiQuery({ name: 'year', required: true, type: Number })
  @ApiQuery({ name: 'employee_id', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 25, max: 100)' })
  async getPayrollRecords(
    @Req() req: any,
    @Query('month') month: number,
    @Query('year') year: number,
    @Query('employee_id') employeeId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const tenantId = req.user.tenant_id;
    const pageNumber = Math.max(1, parseInt(page || '1', 10) || 1);
    const limitNumber = Math.min(100, Math.max(1, parseInt(limit || '25', 10) || 25));
    return await this.payrollRecordService.getPayrollRecords(
      tenantId,
      Number(month),
      Number(year),
      employeeId,
      pageNumber,
      limitNumber,
    );
  }

  @Get('employee/:employeeId/history')
  @Roles('admin', 'system-admin', 'hr-admin', 'employee', 'manager')
  @ApiOperation({ summary: 'Get payroll history for an employee (Paginated)' })
  @ApiResponse({ status: 200, description: 'Payroll history retrieved successfully.' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 25, max: 100)' })
  async getEmployeePayrollHistory(
    @Req() req: any,
    @Param('employeeId') employeeId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const tenantId = req.user.tenant_id;
    const userRole = req.user.role;
    const userId = req.user.id;
    const pageNumber = Math.max(1, parseInt(page || '1', 10) || 1);
    const limitNumber = Math.min(100, Math.max(1, parseInt(limit || '25', 10) || 25));

    
    if (userRole === 'employee') {
     
    }

    return await this.payrollRecordService.getEmployeePayrollHistory(employeeId, tenantId, pageNumber, limitNumber);
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
  @ApiOperation({ summary: 'Get payroll statistics and trends. System-admin gets all tenants data with tenantId, others get their tenant data' })
  @ApiResponse({ status: 200, description: 'Payroll statistics retrieved successfully with tenantId for each entry' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async getPayrollStatistics(@Req() req: any, @Query() query: PayrollStatisticsQueryDto) {

    const tenantId = req.user.role === 'system-admin' ? undefined : req.user.tenant_id;
    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;
    return await this.payrollRecordService.getPayrollStatistics(tenantId, startDate, endDate);
  }
}

