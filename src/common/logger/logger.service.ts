import { Injectable, Logger } from '@nestjs/common';

/**
 * Context-bound logger interface returned by forChild().
 * Use this instead of creating new Logger(ClassName.name) in each service.
 */
export interface ContextLogger {
  log(message: unknown, ...optionalParams: unknown[]): void;
  error(message: unknown, stack?: string, ...optionalParams: unknown[]): void;
  warn(message: unknown, ...optionalParams: unknown[]): void;
  debug(message: unknown, ...optionalParams: unknown[]): void;
  verbose(message: unknown, ...optionalParams: unknown[]): void;
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
      log: (message: unknown, ...optionalParams: unknown[]) => nestLogger.log(message, ...optionalParams),
      error: (message: unknown, stack?: string, ...optionalParams: unknown[]) =>
        nestLogger.error(message, stack, ...optionalParams),
      warn: (message: unknown, ...optionalParams: unknown[]) => nestLogger.warn(message, ...optionalParams),
      debug: (message: unknown, ...optionalParams: unknown[]) => nestLogger.debug(message, ...optionalParams),
      verbose: (message: unknown, ...optionalParams: unknown[]) => nestLogger.verbose(message, ...optionalParams),
    };
  }
}
