import { Injectable, Logger } from '@nestjs/common';

/**
 * Context-bound logger interface returned by forChild().
 * Use this instead of creating new Logger(ClassName.name) in each service.
 */
export interface ContextLogger {
  log(message: any, ...optionalParams: any[]): void;
  error(message: any, stack?: string, ...optionalParams: any[]): void;
  warn(message: any, ...optionalParams: any[]): void;
  debug(message: any, ...optionalParams: any[]): void;
  verbose(message: any, ...optionalParams: any[]): void;
}

/**
 * Common logger service. Inject this and use forChild(context) so you don't
 * instantiate Logger in every class.
 *
 * Usage (e.g. in auth module):
 *   constructor(private readonly loggerService: LoggerService) {}
 *   private readonly logger = this.loggerService.forChild(AuthService.name);
 *   this.logger.log('Something happened');
 */
@Injectable()
export class LoggerService {
  /**
   * Returns a logger bound to the given context (e.g. service/class name).
   */
  forChild(context: string): ContextLogger {
    const nestLogger = new Logger(context);
    return {
      log: (message: any, ...optionalParams: any[]) =>
        nestLogger.log(message, ...optionalParams),
      error: (message: any, stack?: string, ...optionalParams: any[]) =>
        nestLogger.error(message, stack, ...optionalParams),
      warn: (message: any, ...optionalParams: any[]) =>
        nestLogger.warn(message, ...optionalParams),
      debug: (message: any, ...optionalParams: any[]) =>
        nestLogger.debug(message, ...optionalParams),
      verbose: (message: any, ...optionalParams: any[]) =>
        nestLogger.verbose(message, ...optionalParams),
    };
  }
}
