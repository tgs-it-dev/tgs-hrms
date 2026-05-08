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
import {
  WorkflowRequestType,
  WorkflowRequestStatus,
} from '../../common/constants/enums';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedRequest } from '../../common/types/request.types';

@ApiTags('Workflow')
@ApiBearerAuth()
@Controller('workflow')
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  // ── Approver inbox: requests waiting on the current user's role ──────────

  @Get('approvals')
  @UseGuards(RolesGuard)
  @Roles('manager', 'admin', 'hr-admin', 'system-admin', 'network-admin')
  @ApiOperation({
    summary: `List pending requests awaiting approval by the current user's role`,
  })
  @ApiQuery({
    name: 'type',
    enum: WorkflowRequestType,
    required: false,
    description: 'Filter by request type (leave / wfh / overtime)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (default 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page (default 20)',
  })
  @ApiOkResponse({
    description: `Paginated list of requests pending the current user's approval`,
  })
  async getPendingApprovals(
    @Request() req: AuthenticatedRequest,
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

  // ── Requestor history: all requests submitted by the current user ─────────

  @Get('my-requests')
  @ApiOperation({
    summary:
      'List all workflow requests submitted by the current user with full step history',
  })
  @ApiQuery({
    name: 'type',
    enum: WorkflowRequestType,
    required: false,
    description: 'Filter by request type (leave / wfh / overtime)',
  })
  @ApiQuery({
    name: 'status',
    enum: WorkflowRequestStatus,
    required: false,
    description: 'Filter by request status',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (default 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page (default 20)',
  })
  @ApiOkResponse({
    description: `Paginated list of the current user's workflow requests with steps`,
  })
  async getMyRequests(
    @Request() req: AuthenticatedRequest,
    @Query('type') type?: WorkflowRequestType,
    @Query('status') status?: WorkflowRequestStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.workflowService.getMyRequests(
      req.user.tenant_id,
      req.user.id,
      type,
      status,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  // ── Lookup by related entity (must be before /:id to avoid param collision) ──

  @Get('requests/by-entity/:entityId')
  @ApiOperation({
    summary:
      'Get the workflow request linked to a leave, WFH, or overtime record',
  })
  @ApiParam({
    name: 'entityId',
    description: 'UUID of the related entity (leave / WFH / overtime)',
  })
  @ApiOkResponse({ description: 'Matching workflow request or null' })
  async getRequestByEntity(
    @Param('entityId', ParseUUIDPipe) entityId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.workflowService.getWorkflowRequestByEntity(
      entityId,
      req.user.tenant_id,
    );
  }

  // ── Single request detail ─────────────────────────────────────────────────

  @Get('requests/:id')
  @ApiOperation({
    summary: 'Get a workflow request with its full step-by-step history',
  })
  @ApiParam({ name: 'id', description: 'Workflow request UUID' })
  @ApiOkResponse({
    description: 'Workflow request with all steps ordered by step_order',
  })
  @ApiNotFoundResponse({ description: 'Workflow request not found' })
  async getRequestById(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.workflowService.getWorkflowRequestById(id, req.user.tenant_id);
  }

  // ── Approve or reject the current pending step ────────────────────────────

  @Post('requests/:id/decision')
  @UseGuards(RolesGuard)
  @Roles('manager', 'admin', 'hr-admin', 'system-admin', 'network-admin')
  @ApiOperation({
    summary: 'Approve or reject the current pending step of a workflow request',
  })
  @ApiParam({ name: 'id', description: 'Workflow request UUID' })
  @ApiBody({ type: ActOnStepDto })
  @ApiOkResponse({
    description: 'Updated workflow request after the decision is recorded',
  })
  @ApiForbiddenResponse({
    description:
      'Your role does not match the required approver role for this step',
  })
  @ApiBadRequestResponse({
    description:
      'Request is not in an actionable state or no pending step exists',
  })
  @ApiNotFoundResponse({ description: 'Workflow request not found' })
  async submitDecision(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActOnStepDto,
    @Request() req: AuthenticatedRequest,
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

  // ── Approval step configuration ───────────────────────────────────────────

  @Get('configs')
  @UseGuards(RolesGuard)
  @Roles('admin', 'hr-admin', 'system-admin', 'network-admin')
  @ApiOperation({
    summary: 'Get approval step configuration for one or all request types',
  })
  @ApiQuery({
    name: 'type',
    enum: WorkflowRequestType,
    required: false,
    description: 'Filter by request type',
  })
  @ApiOkResponse({
    description: 'Config rows ordered by request_type then step_order',
  })
  async getConfigs(
    @Request() req: AuthenticatedRequest,
    @Query('type') type?: WorkflowRequestType,
  ) {
    return this.workflowService.getWorkflowConfigs(req.user.tenant_id, type);
  }

  @Put('configs')
  @UseGuards(RolesGuard)
  @Roles('admin', 'system-admin')
  @ApiOperation({
    summary: 'Create or update approval step configuration for a request type',
  })
  @ApiBody({ type: UpsertWorkflowConfigDto })
  @ApiOkResponse({
    description: 'Updated config rows for the given request type',
  })
  async upsertConfig(
    @Body() dto: UpsertWorkflowConfigDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.workflowService.upsertWorkflowConfig(req.user.tenant_id, dto);
  }

  // ── Workflow engine toggle ────────────────────────────────────────────────

  @Get('settings/enabled')
  @UseGuards(RolesGuard)
  @ApiOperation({
    summary: 'Check whether the workflow engine is enabled for this tenant',
  })
  @ApiOkResponse({ description: '{ workflow_enabled: boolean }' })
  async getWorkflowEnabled(@Request() req: AuthenticatedRequest) {
    return this.workflowService.getWorkflowEnabled(req.user.tenant_id);
  }

  @Patch('settings/enabled')
  @UseGuards(RolesGuard)
  @Roles('admin', 'system-admin')
  @ApiOperation({
    summary: 'Enable or disable the workflow engine for this tenant',
    description:
      'When disabled, leave approvals fall back to the legacy direct-approve/reject flow.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { enabled: { type: 'boolean' } },
      required: ['enabled'],
    },
  })
  @ApiOkResponse({ description: '{ workflow_enabled: boolean }' })
  async setWorkflowEnabled(
    @Body('enabled') enabled: boolean,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.workflowService.setWorkflowEnabled(req.user.tenant_id, enabled);
  }
}
