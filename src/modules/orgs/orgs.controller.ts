import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { OrgsService } from './orgs.service';
import { CreateInviteDto } from './dto/create-invite.dto';
import { AuthenticatedRequest } from '../../common/types/request.types';

@ApiTags('Orgs')
@ApiBearerAuth()
@Controller('orgs')
export class OrgsController {
  constructor(private readonly orgsService: OrgsService) {}

  /**
   * POST /orgs/:orgId/invites
   *
   * Creates a one-time invite link for the given email address.
   * Requires the caller to be a member of the org (enforced via
   * validateOrgAccess inside the service).
   */
  @Post(':orgId/invites')
  @ApiOperation({ summary: 'Create a one-time org invite link' })
  @ApiParam({ name: 'orgId', type: 'string', format: 'uuid' })
  async createInvite(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body() dto: CreateInviteDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const invitedBy = req.user.id;
    // Guard: only org members may invite others
    await this.orgsService.validateOrgAccess(invitedBy, orgId);
    return this.orgsService.createInvite(orgId, dto, invitedBy);
  }

  /**
   * GET /orgs/invites/:token
   *
   * Public endpoint — returns org name, invited email, and role so the
   * frontend can render the invite landing page before the user logs in.
   * Does NOT reveal whether the token has been used or is expired
   * (that is surfaced only when the user attempts to accept).
   */
  @Public()
  @Get('invites/:token')
  @ApiOperation({ summary: 'Get public invite metadata' })
  @ApiParam({ name: 'token', type: 'string' })
  getInviteInfo(@Param('token') token: string) {
    return this.orgsService.getInviteInfo(token);
  }

  /**
   * POST /orgs/invites/:token/accept
   *
   * Authenticated endpoint — the logged-in user accepts the invite.
   * - If the token was already used → 410 Gone
   * - If the token expired (>24 h)  → 400 with a human-readable message
   * - If the user's email matches   → auto-added to the org, no re-registration
   */
  @Post('invites/:token/accept')
  @ApiOperation({ summary: 'Accept an org invite (existing user auto-join)' })
  @ApiParam({ name: 'token', type: 'string' })
  acceptInvite(
    @Param('token') token: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.orgsService.acceptInvite(token, req.user.id);
  }
}
