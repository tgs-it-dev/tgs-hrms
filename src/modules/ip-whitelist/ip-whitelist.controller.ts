import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { IpWhitelistService } from './ip-whitelist.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AddIpDto } from './dto/add-ip.dto';
import {
  IpWhitelistEntryDto,
  IpRestrictionToggleResponseDto,
  RemoveIpResponseDto,
  CurrentIpResponseDto,
} from './dto/ip-whitelist-response.dto';
import { AuthenticatedRequest } from 'src/common/types/request.types';
import { BypassIpWhitelist } from '../../common/decorators/bypass-ip-whitelist.decorator';

function normalizeControllerIp(ip: string): string {
  const match = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  return match ? match[1] : ip;
}

@ApiTags('IP Whitelist')
@Controller('ip-whitelist')
@UseGuards(RolesGuard, PermissionsGuard)
@ApiBearerAuth()
export class IpWhitelistController {
  private readonly logger = new Logger(IpWhitelistController.name);

  constructor(private readonly ipWhitelistService: IpWhitelistService) {}

  @Get('my-ip')
  @BypassIpWhitelist()
  @Roles('admin', 'system-admin', 'hr-admin', 'manager', 'employee')
  @ApiOperation({
    summary: 'Get current request IP address',
    description:
      'Returns the detected IP address of the current request as seen by the server. Useful for admins to find their own IP before adding it to the whitelist.',
  })
  @ApiResponse({
    status: 200,
    description: 'Current IP address detected successfully.',
    type: CurrentIpResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — bearer token missing or invalid.',
  })
  getMyIp(@Request() req: AuthenticatedRequest): CurrentIpResponseDto {
    const raw = req.clientIp ?? req.ip ?? '0.0.0.0';
    const ip_address = normalizeControllerIp(raw);
    this.logger.log(
      `IP detection requested by tenant: ${req.user.tenant_id}, ip: ${ip_address}`,
    );
    return { ip_address };
  }

  @Post('enable')
  @Roles('admin', 'system-admin')
  @ApiOperation({
    summary: 'Enable IP restriction for the tenant',
    description:
      'Activates IP-based access control for the current tenant. Once enabled, only requests from whitelisted IP addresses will be allowed. Ensure at least one IP is whitelisted before enabling to avoid locking yourself out.',
  })
  @ApiResponse({
    status: 200,
    description: 'IP restriction successfully enabled.',
    type: IpRestrictionToggleResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — bearer token missing or invalid.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden — requires admin or system-admin role.',
  })
  async enableRestriction(@Request() req: AuthenticatedRequest) {
    this.logger.log(
      `Enabling IP restriction for tenant: ${req.user.tenant_id}`,
    );
    await this.ipWhitelistService.enableIpRestriction(req.user.tenant_id);
    return { message: 'IP restriction enabled' };
  }

  @Post('disable')
  @Roles('admin', 'system-admin')
  @ApiOperation({
    summary: 'Disable IP restriction for the tenant',
    description:
      'Deactivates IP-based access control for the current tenant. All IP addresses will be allowed to make requests once disabled. Whitelisted IPs are preserved and can be re-enabled later.',
  })
  @ApiResponse({
    status: 200,
    description: 'IP restriction successfully disabled.',
    type: IpRestrictionToggleResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — bearer token missing or invalid.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden — requires admin or system-admin role.',
  })
  async disableRestriction(@Request() req: AuthenticatedRequest) {
    this.logger.log(
      `Disabling IP restriction for tenant: ${req.user.tenant_id}`,
    );
    await this.ipWhitelistService.disableIpRestriction(req.user.tenant_id);
    return { message: 'IP restriction disabled' };
  }

  @Get()
  @Roles('admin', 'system-admin')
  @ApiOperation({
    summary: 'List whitelisted IP addresses',
    description:
      'Returns a paginated list of whitelisted IPs for the current tenant, ordered by most recently added.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    example: 1,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    example: 10,
    description: 'Items per page (default: 10)',
  })
  @ApiResponse({
    status: 200,
    description: 'Whitelisted IPs retrieved successfully.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — bearer token missing or invalid.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden — requires admin or system-admin role.',
  })
  async getWhitelistedIps(
    @Request() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNumber = Math.max(1, parseInt(page || '1', 10) || 1);
    const limitNumber = Math.max(1, parseInt(limit || '10', 10) || 10);
    this.logger.log(
      `Fetching whitelisted IPs for tenant: ${req.user.tenant_id}, page: ${pageNumber}, limit: ${limitNumber}`,
    );
    return this.ipWhitelistService.getWhitelistedIps(
      req.user.tenant_id,
      pageNumber,
      limitNumber,
    );
  }

  @Post()
  @Roles('admin', 'system-admin')
  @ApiOperation({
    summary: 'Add an IP address to the whitelist',
    description:
      'Adds a single IPv4 or IPv6 address to the tenant whitelist. If the IP is already whitelisted, the existing entry is returned without error. Changes take effect immediately — no restart required.',
  })
  @ApiBody({ type: AddIpDto })
  @ApiResponse({
    status: 201,
    description: 'IP address successfully added to the whitelist.',
    type: IpWhitelistEntryDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad request — invalid IP address format or missing required fields.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — bearer token missing or invalid.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden — requires admin or system-admin role.',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict — IP address is already whitelisted.',
  })
  async addIp(@Request() req: AuthenticatedRequest, @Body() body: AddIpDto) {
    this.logger.log(
      `Adding IP ${body.ip_address} to whitelist for tenant: ${req.user.tenant_id}`,
    );
    return this.ipWhitelistService.addIpToWhitelist(
      req.user.tenant_id,
      body.ip_address,
      body.description,
    );
  }

  @Delete(':ipAddress')
  @Roles('admin', 'system-admin')
  @ApiOperation({
    summary: 'Remove an IP address from the whitelist',
    description:
      'Removes the specified IP address from the tenant whitelist. If IP restriction is currently enabled and this is the last whitelisted IP, all subsequent requests from that IP will be blocked. The removal takes effect immediately.',
  })
  @ApiParam({
    name: 'ipAddress',
    description: 'The IPv4 or IPv6 address to remove from the whitelist',
    example: '192.168.1.100',
  })
  @ApiResponse({
    status: 200,
    description: 'IP address successfully removed from the whitelist.',
    type: RemoveIpResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — bearer token missing or invalid.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden — requires admin or system-admin role.',
  })
  async removeIp(
    @Request() req: AuthenticatedRequest,
    @Param('ipAddress') ipAddress: string,
  ) {
    this.logger.log(
      `Removing IP ${ipAddress} from whitelist for tenant: ${req.user.tenant_id}`,
    );
    return this.ipWhitelistService.removeIpFromWhitelist(
      req.user.tenant_id,
      ipAddress,
    );
  }
}
