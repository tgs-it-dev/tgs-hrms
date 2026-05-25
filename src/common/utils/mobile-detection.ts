const MOBILE_PLATFORMS = new Set(['mobile', 'ios', 'android']);

const MOBILE_UA_PATTERNS = [
  /android/i,
  /iphone/i,
  /ipad/i,
  /ipod/i,
  /react-native/i,
  /okhttp/i, // Android HTTP client used by most mobile apps
  /dart/i, // Flutter apps
  /expo/i,
];

export function isMobileRequest(opts: {
  platform?: string;
  userAgent?: string;
  appPlatform?: string;
}): boolean {
  const { platform, userAgent, appPlatform } = opts;

  if (platform && MOBILE_PLATFORMS.has(platform.toLowerCase())) return true;
  if (appPlatform && MOBILE_PLATFORMS.has(appPlatform.toLowerCase()))
    return true;
  if (userAgent && MOBILE_UA_PATTERNS.some((re) => re.test(userAgent)))
    return true;

  return false;
}
