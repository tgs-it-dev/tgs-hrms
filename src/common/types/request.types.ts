import { RequestWithUser } from 'src/modules/auth/interfaces';

/**
 * Request with authenticated user (JwtPayload).
 * Alias for RequestWithUser so controllers can use either name.
 */
export type AuthenticatedRequest = RequestWithUser;
