import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/**
 * Mark a route or controller as public (no JWT authentication required).
 * Works in conjunction with JwtAuthGuard registered as APP_GUARD.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
