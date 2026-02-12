/**
 * Shared guard logic – pure helpers only (no services).
 * Single source for role/permission checks used by RolesGuard and PermissionsGuard.
 */

import { UserRole } from '../constants';

const ADMIN_EQUIVALENT_ROLES = new Set<string>([
  UserRole.ADMIN,
  UserRole.SYSTEM_ADMIN,
  UserRole.NETWORK_ADMIN,
  UserRole.HR_ADMIN,
]);

/** Normalized role (lowercase) is admin-equivalent and gets all access. */
export function isAdminEquivalentRole(role: string | undefined | null): boolean {
  if (!role || typeof role !== 'string') return false;
  return ADMIN_EQUIVALENT_ROLES.has(role.trim().toLowerCase());
}

export function normalizeRole(role: string | undefined | null): string {
  return (role || '').trim().toLowerCase();
}
