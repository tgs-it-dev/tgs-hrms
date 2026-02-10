/**
 * Renders email HTML from Handlebars-style templates in src/templates.
 * Uses simple {{variable}} replacement (no full Handlebars dependency).
 */

import { Injectable, Logger } from '@nestjs/common';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

function getTemplatesDir(): string {
  const srcTemplates = join(process.cwd(), 'src', 'templates');
  const distTemplates = join(process.cwd(), 'dist', 'templates');
  if (existsSync(srcTemplates)) return srcTemplates;
  if (existsSync(distTemplates)) return distTemplates;
  return srcTemplates;
}

@Injectable()
export class EmailTemplateService {
  private readonly logger = new Logger(EmailTemplateService.name);

  /**
   * Render a template file with the given variables.
   * Template placeholders: {{variableName}} replaced by variables[variableName].
   */
  render(templateName: string, variables: Record<string, string>): string {
    const dir = getTemplatesDir();
    const path = join(dir, templateName.endsWith('.hbs') ? templateName : `${templateName}.hbs`);
    if (!existsSync(path)) {
      this.logger.warn(`Email template not found: ${path}, using empty string`);
      return '';
    }
    let html = readFileSync(path, 'utf-8');
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      html = html.replace(placeholder, value ?? '');
    }
    return html;
  }
}
