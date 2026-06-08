import { SetMetadata } from '@nestjs/common';

export const BYPASS_IP_WHITELIST_KEY = 'bypassIpWhitelist';

export const BypassIpWhitelist = () =>
  SetMetadata(BYPASS_IP_WHITELIST_KEY, true);
