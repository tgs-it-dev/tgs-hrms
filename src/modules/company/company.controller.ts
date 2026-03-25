import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { Response } from 'express';
import { Res, Param } from '@nestjs/common';
import { CompanyService } from './company.service';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CompanyResponseDto } from './dto/company-response.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { validateImageFile } from '../../common/utils/file-validation.util';

@ApiTags('Company')
@Controller('company')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@ApiBearerAuth()
export class CompanyController {
  private readonly logger = new Logger(CompanyController.name);

  constructor(private readonly companyService: CompanyService) {}

  @Get()
  @ApiOperation({ summary: 'Get company details' })
  @ApiResponse({
    status: 200,
    description: 'Company details retrieved successfully',
    type: CompanyResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Company details not found' })
  async getCompanyDetails(@Request() req: any): Promise<CompanyResponseDto> {
    this.logger.log(`Getting company details for tenant: ${req.user.tenant_id}`);
    return this.companyService.getCompanyDetails(req.user.tenant_id);
  }

  @Get('logo/:tenantId')
  @ApiOperation({ summary: 'Get company logo by tenant (public)' })
  @ApiResponse({ status: 200, description: 'Company logo streamed' })
  @ApiResponse({ status: 404, description: 'Logo not found' })
  async getCompanyLogo(
    @Param('tenantId') tenantId: string,
    @Res() res: Response,
  ) {
    try {
      const result = await this.companyService.getCompanyLogoStream(tenantId);
      if (result.redirectUrl) {
        return res.redirect(302, result.redirectUrl);
      }
      if (!result.fileStream) {
        return res.status(404).json({ message: 'Logo not found' });
      }
      res.setHeader('Content-Type', result.contentType);
      if (result.fileSize > 0) {
        res.setHeader('Content-Length', result.fileSize);
      }
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      result.fileStream.pipe(res);
      return;
    } catch (e) {
      return res.status(500).json({ message: 'Error serving company logo' });
    }
  }

  @Put()
  @Roles('admin', 'system-admin')
  @Permissions('manage_company')
  @ApiOperation({ summary: 'Update company details (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Company details updated successfully',
    type: CompanyResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @ApiResponse({ status: 404, description: 'Company details not found' })
  async updateCompanyDetails(
    @Request() req: any,
    @Body() updateDto: UpdateCompanyDto,
  ): Promise<CompanyResponseDto> {
    this.logger.log(`Updating company details for tenant: ${req.user.tenant_id}, user: ${req.user.sub}`);
    return this.companyService.updateCompanyDetails(
      req.user.tenant_id,
      req.user.role,
      updateDto,
    );
  }

  @Post('logo')
  @Roles('admin', 'system-admin')
  @Permissions('manage_company')
  @UseInterceptors(FileInterceptor('logo'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Update company logo (Admin only)' })
  @ApiBody({
    description: 'Company logo file',
    schema: {
      type: 'object',
      properties: {
        logo: {
          type: 'string',
          format: 'binary',
          description: 'Logo file - only JPG, JPEG, PNG, GIF or WebP allowed (max 5MB). JFIF and other formats are not accepted.',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Company logo updated successfully',
    type: CompanyResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @ApiResponse({ status: 404, description: 'Company details not found' })
  @ApiResponse({ status: 400, description: 'Invalid file type or size' })
  async updateCompanyLogo(
    @Request() req: any,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({
            fileType: /^image\/(jpeg|jpg|png|gif|webp|x-png)$/,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
  ): Promise<CompanyResponseDto> {
    validateImageFile(file);
    this.logger.log(`Updating company logo for tenant: ${req.user.tenant_id}, user: ${req.user.sub}`);
    return this.companyService.updateCompanyLogo(
      req.user.tenant_id,
      req.user.role,
      file,
    );
  }
}
