import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Param,
  Body,
  Query,
  Request,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiParam,
  ApiBody,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiForbiddenResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';

import { WorkflowService } from './workflow.service';
import { ActOnStepDto } from './dto/act-on-step.dto';
import { UpsertWorkflowConfigDto } from './dto/upsert-workflow-config.dto';
import { WorkflowRequestType } from '../../common/constants/enums';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Workflow')
@ApiBearerAuth()
@Controller('workflow')
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  // ── Pending approvals for the current actor's role ────────────────────────

  @Get('requests')
  @UseGuards(RolesGuard)
  @Roles('manager', 'admin', 'hr-admin', 'system-admin', 'network-admin')
  @ApiOperation({ summary: 'Get pending workflow requests awaiting action by the current user role' })
  @ApiQuery({ name: 'type', enum: WorkflowRequestType, required: false, description: 'Filter by request type (leave / wfh)' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page (default 20)' })
  @ApiOkResponse({ description: 'Paginated list of pending workflow requests' })
  async getPendingRequests(
    @Request() req: any,
    @Query('type') type?: WorkflowRequestType,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.workflowService.getPendingStepsForRole(
      req.user.tenant_id,
      req.user.role,
      type,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  // ── Get single workflow request with full step history ────────────────────

  @Get('requests/:id')
  @ApiOperation({ summary: 'Get workflow request details with full step history' })
  @ApiParam({ name: 'id', description: 'Workflow request UUID' })
  @ApiOkResponse({ description: 'Workflow request with all steps' })
  @ApiNotFoundResponse({ description: 'Workflow request not found' })
  async getWorkflowRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
  ) {
    return this.workflowService.getWorkflowRequestById(id, req.user.tenant_id);
  }

  // ── Get workflow request by entity (leave/wfh ID) ─────────────────────────

  @Get('requests/entity/:entityId')
  @ApiOperation({ summary: 'Get workflow request by related entity ID (leave or WFH UUID)' })
  @ApiParam({ name: 'entityId', description: 'Related entity UUID (e.g. leave ID or WFH ID)' })
  @ApiOkResponse({ description: 'Matching workflow request or null' })
  async getWorkflowRequestByEntity(
    @Param('entityId', ParseUUIDPipe) entityId: string,
    @Request() req: any,
  ) {
    return this.workflowService.getWorkflowRequestByEntity(entityId, req.user.tenant_id);
  }

  // ── Approve or reject current step ───────────────────────────────────────

  @Post('requests/:id/act')
  @UseGuards(RolesGuard)
  @Roles('manager', 'admin', 'hr-admin', 'system-admin', 'network-admin')
  @ApiOperation({ summary: 'Approve or reject the current pending step of a workflow request' })
  @ApiParam({ name: 'id', description: 'Workflow request UUID' })
  @ApiBody({ type: ActOnStepDto })
  @ApiOkResponse({ description: 'Updated workflow request after acting on the step' })
  @ApiForbiddenResponse({ description: "Actor's role does not match the step's required approver role" })
  @ApiBadRequestResponse({ description: 'Request is not in an actionable state or no pending step found' })
  @ApiNotFoundResponse({ description: 'Workflow request not found' })
  async actOnStep(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActOnStepDto,
    @Request() req: any,
  ) {
    return this.workflowService.actOnCurrentStep(
      id,
      req.user.id,
      req.user.role,
      req.user.tenant_id,
      dto.action,
      dto.remarks,
    );
  }

  // ── Workflow config management ────────────────────────────────────────────

  @Get('configs')
  @UseGuards(RolesGuard)
  @Roles('admin', 'hr-admin', 'system-admin', 'network-admin')
  @ApiOperation({ summary: 'Get workflow approval step configuration for the tenant' })
  @ApiQuery({ name: 'type', enum: WorkflowRequestType, required: false, description: 'Filter by request type' })
  @ApiOkResponse({ description: 'List of workflow config rows ordered by request_type and step_order' })
  async getConfigs(
    @Request() req: any,
    @Query('type') type?: WorkflowRequestType,
  ) {
    return this.workflowService.getWorkflowConfigs(req.user.tenant_id, type);
  }

  @Put('configs')
  @UseGuards(RolesGuard)
  @Roles('admin', 'system-admin')
  @ApiOperation({ summary: 'Upsert workflow step configuration for a request type' })
  @ApiBody({ type: UpsertWorkflowConfigDto })
  @ApiOkResponse({ description: 'Updated list of config rows for the given request type' })
  async upsertConfig(
    @Body() dto: UpsertWorkflowConfigDto,
    @Request() req: any,
  ) {
    return this.workflowService.upsertWorkflowConfig(req.user.tenant_id, dto);
  }

  // ── Feature flag ─────────────────────────────────────────────────────────

  @Get('feature-flag')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Get the workflow engine enabled/disabled state for the tenant' })
  @ApiOkResponse({ description: '{ workflow_enabled: boolean }' })
  async getFeatureFlag(@Request() req: any) {
    return this.workflowService.getWorkflowEnabled(req.user.tenant_id);
  }

  @Patch('feature-flag')
  @UseGuards(RolesGuard)
  @Roles('admin', 'system-admin')
  @ApiOperation({
    summary: 'Enable or disable the workflow engine for the tenant',
    description:
      'When disabled, leave approvals fall back to the legacy direct-approve/reject endpoints. Only admins can toggle this flag.',
  })
  @ApiBody({ schema: { type: 'object', properties: { enabled: { type: 'boolean' } }, required: ['enabled'] } })
  @ApiOkResponse({ description: '{ workflow_enabled: boolean }' })
  async setFeatureFlag(@Body('enabled') enabled: boolean, @Request() req: any) {
    return this.workflowService.setWorkflowEnabled(req.user.tenant_id, enabled);
  }
}
