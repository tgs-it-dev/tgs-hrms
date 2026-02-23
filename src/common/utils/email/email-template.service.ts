/**
 * Renders email HTML from Handlebars templates in src/templates.
 */

import { Injectable } from '@nestjs/common';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import Handlebars from 'handlebars';
import { ContextLogger, LoggerService } from '../../logger/logger.service';

function getTemplatesDir(): string {
  const srcTemplates = join(process.cwd(), 'src', 'templates');
  const distTemplates = join(process.cwd(), 'dist', 'templates');
  if (existsSync(srcTemplates)) return srcTemplates;
  if (existsSync(distTemplates)) return distTemplates;
  return srcTemplates;
}

@Injectable()
export class EmailTemplateService {
  private readonly logger: ContextLogger;

  constructor(private readonly loggerService: LoggerService) {
    this.logger = this.loggerService.forChild(EmailTemplateService.name);
  }

  /**
   * Load and compile a Handlebars template, then inject variables.
   */
  render(templateName: string, variables: Record<string, string>): string {
    const dir = getTemplatesDir();
    const filePath = join(dir, templateName.endsWith('.hbs') ? templateName : `${templateName}.hbs`);
    if (!existsSync(filePath)) {
      this.logger.warn(`Email template not found: ${filePath}, using empty string`);
      return '';
    }
    const source = readFileSync(filePath, 'utf-8');
    const template = Handlebars.compile(source);
    return template(variables);
  }
}
