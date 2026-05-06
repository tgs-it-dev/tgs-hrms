import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FEATURE_KEY } from 'src/common/decorators/feature.decorator';
import { SystemSettingsService } from 'src/modules/system/system-settings/system-settings.service';

@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly systemSettings: SystemSettingsService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const featureKey = this.reflector.getAllAndOverride<string>(FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!featureKey) return true;

    const settingKey = `${featureKey}_enabled`;
    const enabled = this.systemSettings.getBoolean(settingKey, true);

    if (!enabled) {
      throw new ForbiddenException(
        `This feature is currently disabled. Please contact your administrator.`,
      );
    }

    return true;
  }
}
