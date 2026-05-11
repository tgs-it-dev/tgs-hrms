import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Request,
  UseGuards,
  ParseUUIDPipe,
  ParseIntPipe,
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
import { AddWorkflowConfigStepDto } from './dto/add-workflow-config-step.dto';
import { UpdateWorkflowConfigStepDto } from './dto/update-workflow-config-step.dto';
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
    summary: `List approval requests for the current user's role`,
    description: `**view=pending** (default) — requests awaiting this user's action now.
**view=history** — requests on which this user has already approved or rejected a step.
**view=all** — both combined, sorted by status priority: pending → in_review → approved → rejected.`,
  })
  @ApiQuery({
    name: 'view',
    required: false,
    enum: ['pending', 'history', 'all'],
    description: 'pending (default) | history | all',
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
    description: `Paginated list of approval requests`,
    schema: {
      example: {
        items: [
          {
            id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            request_type: 'wfh',
            status: 'pending',
            requestor_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
            requestor: {
              id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
              first_name: 'Ali',
              last_name: 'Hassan',
            },
            tenant_id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
            current_step_order: 1,
            total_steps: 2,
            created_at: '2026-05-09T08:00:00.000Z',
            updated_at: '2026-05-09T08:00:00.000Z',
            steps: [
              {
                id: 'step-uuid-1',
                step_order: 1,
                step_label: 'Manager Approval',
                approver_role: 'manager',
                status: 'pending',
                approver_id: null,
                approver: null,
                remarks: null,
                acted_at: null,
              },
            ],
            request_data: {
              id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
              start_date: '2026-05-12',
              end_date: '2026-05-14',
              reason: 'Working remotely for project deadline',
              status: 'pending',
              attachments: [],
            },
          },
          {
            id: 'd4e5f6a7-b8c9-0123-defa-234567890123',
            request_type: 'overtime',
            status: 'approved',
            requestor_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
            requestor: {
              id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
              first_name: 'Ali',
              last_name: 'Hassan',
            },
            tenant_id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
            current_step_order: 2,
            total_steps: 2,
            created_at: '2026-05-07T10:00:00.000Z',
            updated_at: '2026-05-08T11:00:00.000Z',
            steps: [
              {
                id: 'step-uuid-2',
                step_order: 1,
                step_label: 'Manager Approval',
                approver_role: 'manager',
                status: 'approved',
                approver_id: 'mgr-uuid',
                approver: {
                  id: 'mgr-uuid',
                  first_name: 'Sara',
                  last_name: 'Khan',
                },
                remarks: 'Looks good',
                acted_at: '2026-05-08T11:00:00.000Z',
              },
              {
                id: 'step-uuid-3',
                step_order: 2,
                step_label: 'HR Approval',
                approver_role: 'hr-admin',
                status: 'approved',
                approver_id: 'hr-uuid',
                approver: {
                  id: 'hr-uuid',
                  first_name: 'Nadia',
                  last_name: 'Malik',
                },
                remarks: null,
                acted_at: '2026-05-08T12:00:00.000Z',
              },
            ],
            request_data: {
              id: 'd4e5f6a7-b8c9-0123-defa-234567890123',
              start_date: '2026-05-10',
              end_date: '2026-05-10',
              hours: 4,
              reason: 'Critical deployment on Saturday',
              status: 'approved',
              attachments: [],
            },
          },
        ],
        total: 2,
        page: 1,
        limit: 20,
      },
    },
  })
  async getPendingApprovals(
    @Request() req: AuthenticatedRequest,
    @Query('view') view?: 'pending' | 'history' | 'all',
    @Query('type') type?: WorkflowRequestType,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.workflowService.getPendingStepsForRole(
      req.user.tenant_id,
      req.user.id,
      req.user.role,
      view ?? 'pending',
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
    description: `Paginated list of the current user's workflow requests with steps and entity data`,
    schema: {
      example: {
        items: [
          {
            id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            request_type: 'wfh',
            status: 'pending',
            requestor_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
            requestor: {
              id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
              first_name: 'Ali',
              last_name: 'Hassan',
            },
            tenant_id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
            current_step_order: 1,
            total_steps: 2,
            created_at: '2026-05-09T08:00:00.000Z',
            updated_at: '2026-05-09T08:00:00.000Z',
            steps: [
              {
                id: 'step-uuid-1',
                step_order: 1,
                step_label: 'Manager Approval',
                approver_role: 'manager',
                status: 'pending',
                approver_id: null,
                approver: null,
                remarks: null,
                acted_at: null,
              },
            ],
            request_data: {
              id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
              start_date: '2026-05-12',
              end_date: '2026-05-14',
              reason: 'Working remotely for project deadline',
              status: 'pending',
              attachments: [],
            },
          },
          {
            id: 'd4e5f6a7-b8c9-0123-defa-234567890123',
            request_type: 'overtime',
            status: 'in_review',
            requestor_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
            requestor: {
              id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
              first_name: 'Ali',
              last_name: 'Hassan',
            },
            tenant_id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
            current_step_order: 2,
            total_steps: 2,
            created_at: '2026-05-08T10:00:00.000Z',
            updated_at: '2026-05-09T09:00:00.000Z',
            steps: [
              {
                id: 'step-uuid-2',
                step_order: 1,
                step_label: 'Manager Approval',
                approver_role: 'manager',
                status: 'approved',
                approver_id: 'mgr-uuid',
                approver: {
                  id: 'mgr-uuid',
                  first_name: 'Sara',
                  last_name: 'Khan',
                },
                remarks: 'Approved',
                acted_at: '2026-05-09T09:00:00.000Z',
              },
              {
                id: 'step-uuid-3',
                step_order: 2,
                step_label: 'HR Approval',
                approver_role: 'hr-admin',
                status: 'pending',
                approver_id: null,
                approver: null,
                remarks: null,
                acted_at: null,
              },
            ],
            request_data: {
              id: 'd4e5f6a7-b8c9-0123-defa-234567890123',
              start_date: '2026-05-10',
              end_date: '2026-05-10',
              hours: 4,
              reason: 'Critical deployment on Saturday',
              status: 'pending',
              attachments: [],
            },
          },
          {
            id: 'e5f6a7b8-c9d0-1234-efab-345678901234',
            request_type: 'leave',
            status: 'approved',
            requestor_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
            requestor: {
              id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
              first_name: 'Ali',
              last_name: 'Hassan',
            },
            tenant_id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
            current_step_order: 2,
            total_steps: 2,
            created_at: '2026-05-01T08:00:00.000Z',
            updated_at: '2026-05-03T12:00:00.000Z',
            steps: [
              {
                id: 'step-uuid-4',
                step_order: 1,
                step_label: 'HR Approval',
                approver_role: 'hr-admin',
                status: 'approved',
                approver_id: 'hr-uuid',
                approver: {
                  id: 'hr-uuid',
                  first_name: 'Nadia',
                  last_name: 'Malik',
                },
                remarks: null,
                acted_at: '2026-05-03T12:00:00.000Z',
              },
            ],
            request_data: {
              id: 'e5f6a7b8-c9d0-1234-efab-345678901234',
              start_date: '2026-05-15',
              end_date: '2026-05-17',
              total_days: 3,
              reason: 'Family function',
              status: 'approved',
              attachments: [],
              leave_type_id: 'lt-uuid-annual',
            },
          },
        ],
        total: 3,
        page: 1,
        limit: 20,
      },
    },
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
    description: 'Workflow request with all steps and the linked entity data',
    schema: {
      example: {
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        request_type: 'overtime',
        status: 'pending',
        requestor_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
        tenant_id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
        current_step_order: 1,
        total_steps: 2,
        created_at: '2026-05-09T08:00:00.000Z',
        updated_at: '2026-05-09T08:00:00.000Z',
        steps: [
          {
            id: 'step-uuid-1',
            step_order: 1,
            step_label: 'Manager Approval',
            approver_role: 'manager',
            status: 'pending',
            approver_id: null,
            remarks: null,
            acted_at: null,
          },
          {
            id: 'step-uuid-2',
            step_order: 2,
            step_label: 'HR Approval',
            approver_role: 'hr-admin',
            status: 'pending',
            approver_id: null,
            remarks: null,
            acted_at: null,
          },
        ],
        request_data: {
          id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          start_date: '2026-05-10',
          end_date: '2026-05-10',
          hours: 4,
          reason: 'Critical deployment on Saturday',
          status: 'pending',
          attachments: ['https://s3.example.com/overtime-docs/proof.jpg'],
        },
      },
    },
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

  @Post('configs/steps')
  @UseGuards(RolesGuard)
  @Roles('admin', 'system-admin')
  @ApiOperation({
    summary: 'Add a step to a workflow config',
    description:
      'Appends a new approval step at the end of the existing steps for ' +
      'the given request_type. step_order is auto-assigned.',
  })
  @ApiBody({ type: AddWorkflowConfigStepDto })
  @ApiOkResponse({
    description:
      'All config steps for the request type after adding the new one',
  })
  async addConfigStep(
    @Body() dto: AddWorkflowConfigStepDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.workflowService.addWorkflowConfigStep(req.user.tenant_id, dto);
  }

  @Patch('configs/:requestType/steps/:stepOrder')
  @UseGuards(RolesGuard)
  @Roles('admin', 'system-admin')
  @ApiOperation({ summary: 'Update a workflow config step' })
  @ApiParam({ name: 'requestType', enum: WorkflowRequestType })
  @ApiParam({ name: 'stepOrder', type: Number, example: 1 })
  @ApiBody({ type: UpdateWorkflowConfigStepDto })
  @ApiOkResponse({ description: 'Updated step' })
  @ApiNotFoundResponse({ description: 'Step not found' })
  @ApiBadRequestResponse({ description: 'No fields provided to update' })
  async updateConfigStep(
    @Param('requestType') requestType: WorkflowRequestType,
    @Param('stepOrder', ParseIntPipe) stepOrder: number,
    @Body() dto: UpdateWorkflowConfigStepDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.workflowService.updateWorkflowConfigStep(
      req.user.tenant_id,
      requestType,
      stepOrder,
      dto,
    );
  }

  @Delete('configs/:requestType/steps/:stepOrder')
  @UseGuards(RolesGuard)
  @Roles('admin', 'system-admin')
  @ApiOperation({
    summary: 'Delete a step from a workflow config',
    description:
      'Removes the step and re-numbers remaining steps contiguously from 1. ' +
      'Cannot delete the last remaining step.',
  })
  @ApiParam({ name: 'requestType', enum: WorkflowRequestType })
  @ApiParam({ name: 'stepOrder', type: Number, example: 2 })
  @ApiOkResponse({
    description: 'Remaining config steps after deletion, re-numbered from 1',
  })
  @ApiNotFoundResponse({ description: 'Step not found' })
  @ApiBadRequestResponse({ description: 'Cannot delete last remaining step' })
  async deleteConfigStep(
    @Param('requestType') requestType: WorkflowRequestType,
    @Param('stepOrder', ParseIntPipe) stepOrder: number,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.workflowService.deleteWorkflowConfigStep(
      req.user.tenant_id,
      requestType,
      stepOrder,
    );
  }

  // ── Workflow engine toggle ────────────────────────────────────────────────

  @Get('settings')
  @UseGuards(RolesGuard)
  @ApiOperation({
    summary: 'Get workflow enabled status for all request types',
  })
  @ApiOkResponse({
    description:
      '{ leave_workflow_enabled, wfh_workflow_enabled, overtime_workflow_enabled }',
    schema: {
      example: {
        leave_workflow_enabled: true,
        wfh_workflow_enabled: false,
        overtime_workflow_enabled: true,
      },
    },
  })
  async getWorkflowSettings(@Request() req: AuthenticatedRequest) {
    return this.workflowService.getWorkflowSettings(req.user.tenant_id);
  }

  @Patch('settings')
  @UseGuards(RolesGuard)
  @Roles('admin', 'system-admin')
  @ApiOperation({
    summary: 'Enable or disable workflow for a specific request type',
    description:
      'Toggles the workflow engine for leave, wfh, or overtime independently. ' +
      'When disabled for a type, requests of that type skip workflow and go directly to approved/rejected.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['request_type', 'enabled'],
      properties: {
        request_type: {
          enum: Object.values(WorkflowRequestType),
          example: WorkflowRequestType.LEAVE,
        },
        enabled: { type: 'boolean', example: true },
      },
    },
  })
  @ApiOkResponse({
    description: 'Updated workflow settings for all types',
    schema: {
      example: {
        leave_workflow_enabled: true,
        wfh_workflow_enabled: false,
        overtime_workflow_enabled: true,
      },
    },
  })
  async setWorkflowEnabled(
    @Body('request_type') requestType: WorkflowRequestType,
    @Body('enabled') enabled: boolean,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.workflowService.setWorkflowEnabled(
      req.user.tenant_id,
      requestType,
      enabled,
    );
  }
}
