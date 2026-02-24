/**
 * Renders email HTML from Handlebars templates in src/templates.
 */

import { Injectable } from '@nestjs/common';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import Handlebars from 'handlebars';
import { ContextLogger, LoggerService } from '../../logger/logger.service';
import { EMAIL_MESSAGE, EMAIL_TEMPLATE } from '../../constants';

function getTemplatesDir(): string {
  const srcTemplates = join(process.cwd(), EMAIL_TEMPLATE.DIR_SRC, EMAIL_TEMPLATE.DIR_TEMPLATES);
  const distTemplates = join(process.cwd(), EMAIL_TEMPLATE.DIR_DIST, EMAIL_TEMPLATE.DIR_TEMPLATES);
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
    const filePath = join(
      dir,
      templateName.endsWith(EMAIL_TEMPLATE.EXTENSION) ? templateName : `${templateName}${EMAIL_TEMPLATE.EXTENSION}`,
    );
    if (!existsSync(filePath)) {
      this.logger.warn(`${EMAIL_MESSAGE.TEMPLATE_NOT_FOUND}: ${filePath}, ${EMAIL_MESSAGE.TEMPLATE_USING_EMPTY}`);
      return '';
    }
    const source = readFileSync(filePath, EMAIL_TEMPLATE.ENCODING);
    const template = Handlebars.compile(source);
    return template(variables);
  }
}
