import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Req,
  Res,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { TeamService } from './team.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { RemoveMemberDto } from './dto/remove-member.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantId } from '../../common/decorators/company.deorator';
import { Request, Response } from 'express';
import { sendCsvResponse } from '../../common/utils/csv.util';

@ApiTags('Teams')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('teams')
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  // CSV EXPORTS (declare before :id routes to avoid conflicts)
  @Get('export')
  @Roles('admin', 'system-admin')
  @ApiOperation({ summary: 'Download teams list as CSV (Admin only)' })
  async exportAll(
    @TenantId() tenantId: string,
    @Res() res: Response,
    @Query('page') page?: string
  ) {
    const pageNumber = Math.max(1, parseInt(page || '1', 10) || 1);
    const { items } = await this.teamService.findAll(tenantId, pageNumber);
    const rows = (items || []).map((t: any) => ({
      id: t.id,
      name: t.name,
      manager_id: t.manager?.id,
      manager_name: t.manager ? `${t.manager.first_name} ${t.manager.last_name}` : '',
    }));
    return sendCsvResponse(res, 'teams.csv', rows);
  }

  @Post()
  @Roles('admin', 'system-admin')
  @ApiOperation({ summary: 'Create a new team' })
  @ApiResponse({ status: 201, description: 'Team created successfully' })
  @ApiResponse({
    status: 400,
    description: 'Invalid manager or manager already managing another team',
  })
  async create(@TenantId() tenantId: string, @Body() createTeamDto: CreateTeamDto) {
    return this.teamService.create(tenantId, createTeamDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all teams in the tenant' })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number for pagination',
    example: '1',
  })
  @ApiResponse({ status: 200, description: 'Returns paginated list of teams' })
  async findAll(@TenantId() tenantId: string, @Query('page') page?: string) {
    const pageNumber = Math.max(1, parseInt(page || '1', 10) || 1);
    return this.teamService.findAll(tenantId, pageNumber);
  }

  @Get('my-teams')
  @ApiOperation({ summary: 'Get teams managed by the current user (managers only)' })
  @ApiResponse({ status: 200, description: 'Returns teams managed by the current user' })
  async getMyTeams(@TenantId() tenantId: string, @Req() req: Request) {
    const userId = (req.user as any).id;
    return this.teamService.getManagerTeams(userId, tenantId);
  }

  @Get('available-employees')
  @ApiOperation({ summary: 'Get employees available for team assignment (managers only)' })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number for pagination',
    example: '1',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search employees by first name or last name',
    example: 'john',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated list of available employees from same department',
  })
  async getAvailableEmployees(
    @TenantId() tenantId: string,
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('search') search?: string
  ) {
    const managerId = (req.user as any).id;
    const pageNumber = Math.max(1, parseInt(page || '1', 10) || 1);
    return this.teamService.getAvailableEmployees(tenantId, managerId, pageNumber, search);
  }

  @Get('my-members')
  @ApiOperation({
    summary: 'Get all team members across teams managed by current user (managers only)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number for pagination',
    example: '1',
  })
  @ApiResponse({ status: 200, description: 'Returns paginated list of all team members' })
  async getMyMembers(
    @TenantId() tenantId: string,
    @Req() req: Request,
    @Query('page') page?: string
  ) {
    const managerId = (req.user as any).id;
    const pageNumber = Math.max(1, parseInt(page || '1', 10) || 1);
    return this.teamService.getAllMembersForManager(tenantId, managerId, pageNumber);
  }

  @Get('available-managers')
  @Roles('admin', 'system-admin')
  @ApiOperation({ summary: 'Get available managers for team assignment' })
  @ApiResponse({ status: 200, description: 'Returns list of available managers' })
  async getAvailableManagers(@TenantId() tenantId: string) {
    return this.teamService.getAvailableManagers(tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific team by ID' })
  @ApiParam({ name: 'id', description: 'Team ID' })
  @ApiResponse({ status: 200, description: 'Returns team details with members' })
  @ApiResponse({ status: 404, description: 'Team not found' })
  async findOne(
    @TenantId() tenantId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string
  ) {
    return this.teamService.findOne(tenantId, id);
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'Get team members with pagination' })
  @ApiParam({ name: 'id', description: 'Team ID' })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number for pagination',
    example: '1',
  })
  @ApiResponse({ status: 200, description: 'Returns paginated list of team members' })
  async getTeamMembers(
    @TenantId() tenantId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query('page') page?: string
  ) {
    const pageNumber = Math.max(1, parseInt(page || '1', 10) || 1);
    return this.teamService.getTeamMembers(tenantId, id, pageNumber);
  }

  @Patch(':id')
  @Roles('admin', 'system-admin')
  @ApiOperation({ summary: 'Update team details' })
  @ApiParam({ name: 'id', description: 'Team ID' })
  @ApiResponse({ status: 200, description: 'Team updated successfully' })
  @ApiResponse({ status: 404, description: 'Team not found' })
  async update(
    @TenantId() tenantId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() updateTeamDto: UpdateTeamDto
  ) {
    return this.teamService.update(tenantId, id, updateTeamDto);
  }

  @Post(':id/members/:employeeId')
  @Roles('admin', 'system-admin', 'manager')
  @ApiOperation({ summary: 'Add an employee to a team' })
  @ApiParam({ name: 'id', description: 'Team ID' })
  @ApiParam({ name: 'employeeId', description: 'Employee ID to add' })
  @ApiResponse({ status: 200, description: 'Employee added to team successfully' })
  @ApiResponse({ status: 400, description: 'Employee already in a team' })
  async addMember(
    @TenantId() tenantId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('employeeId') employeeId: string
  ) {
    await this.teamService.addMemberToTeam(tenantId, id, employeeId);
    return { message: 'Employee added to team successfully' };
  }

  @Post(':id/add-member')
  @ApiOperation({ summary: 'Add an employee to a team' })
  @ApiParam({ name: 'id', description: 'Team ID' })
  @ApiResponse({ status: 200, description: 'Employee added to team successfully' })
  @ApiResponse({ status: 400, description: 'Employee already in a team' })
  async addMemberWithBody(
    @TenantId() tenantId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: AddMemberDto
  ) {
    await this.teamService.addMemberToTeam(tenantId, id, dto.employee_id);
    return { message: 'Employee added to team successfully' };
  }

  @Post(':id/remove-member')
  @ApiOperation({ summary: 'Remove an employee from a team' })
  @ApiParam({ name: 'id', description: 'Team ID' })
  @ApiResponse({ status: 200, description: 'Employee removed from team successfully' })
  async removeMemberWithBody(
    @TenantId() tenantId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: RemoveMemberDto
  ) {
    await this.teamService.removeMemberFromTeam(tenantId, id, dto.employee_id);
    return { message: 'Employee removed from team successfully' };
  }

  @Delete(':id/members/:employeeId')
  @Roles('admin', 'system-admin', 'manager')
  @ApiOperation({ summary: 'Remove an employee from a team' })
  @ApiParam({ name: 'id', description: 'Team ID' })
  @ApiParam({ name: 'employeeId', description: 'Employee ID to remove' })
  @ApiResponse({ status: 200, description: 'Employee removed from team successfully' })
  async removeMember(
    @TenantId() tenantId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('employeeId') employeeId: string
  ) {
    await this.teamService.removeMemberFromTeam(tenantId, id, employeeId);
    return { message: 'Employee removed from team successfully' };
  }

  @Delete(':id')
  @Roles('admin', 'system-admin')
  @ApiOperation({ summary: 'Delete a team' })
  @ApiParam({ name: 'id', description: 'Team ID' })
  @ApiResponse({ status: 200, description: 'Team deleted successfully' })
  async remove(
    @TenantId() tenantId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string
  ) {
    await this.teamService.remove(tenantId, id);
    return { message: 'Team deleted successfully' };
  }
}
