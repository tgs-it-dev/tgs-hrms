/**
 * Roles and Permissions Configuration Service
 */

import { Injectable, Logger } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';

export interface RoleConfig {
  name: string;
  description: string;
  permissions: string[];
  isAdmin: boolean;
  priority: number;
}

export interface PermissionConfig {
  [key: string]: string;
}

export interface RolesPermissionsConfig {
  roles: {
    [key: string]: RoleConfig;
  };
  permissions: {
    [key: string]: PermissionConfig;
  };
  defaultRoles: string[];
  adminRoles: string[];
  hrRoles: string[];
  managerRoles: string[];
  employeeRoles: string[];
}

@Injectable()
export class RolesPermissionsService {
  private readonly logger = new Logger(RolesPermissionsService.name);
  private config: RolesPermissionsConfig;

  constructor() {
    this.loadConfig();
  }

  private loadConfig(): void {
    try {
      const configPath = join(process.cwd(), 'src', 'config', 'roles-permissions.json');
      const configFile = readFileSync(configPath, 'utf8');
      this.config = JSON.parse(configFile);
      this.logger.log('Roles and permissions configuration loaded successfully');
    } catch (error) {
      this.logger.error('Failed to load roles and permissions configuration:', error);
      throw new Error('Failed to load roles and permissions configuration');
    }
  }

  /**
   * Get all roles configuration
   */
  getRoles(): { [key: string]: RoleConfig } {
    return this.config.roles;
  }

  /**
   * Get specific role configuration
   */
  getRole(roleName: string): RoleConfig | undefined {
    return this.config.roles[roleName];
  }

  /**
   * Get all permissions configuration
   */
  getPermissions(): { [key: string]: PermissionConfig } {
    return this.config.permissions;
  }

  /**
   * Get specific permission configuration
   */
  getPermission(permissionName: string): PermissionConfig | undefined {
    return this.config.permissions[permissionName];
  }

  /**
   * Get permissions for a specific role
   */
  getRolePermissions(roleName: string): string[] {
    const role = this.getRole(roleName);
    return role ? role.permissions : [];
  }

  /**
   * Check if user has specific permission
   */
  hasPermission(userRole: string, permission: string): boolean {
    const rolePermissions = this.getRolePermissions(userRole);
    
    // Admin roles have all permissions
    if (this.isAdminRole(userRole)) {
      return true;
    }

    // Check if role has wildcard permission
    if (rolePermissions.includes('*')) {
      return true;
    }

    // Check specific permission
    return rolePermissions.includes(permission);
  }

  /**
   * Check if role is admin role
   */
  isAdminRole(roleName: string): boolean {
    return this.config.adminRoles.includes(roleName);
  }

  /**
   * Check if role is HR role
   */
  isHRRole(roleName: string): boolean {
    return this.config.hrRoles.includes(roleName);
  }

  /**
   * Check if role is manager role
   */
  isManagerRole(roleName: string): boolean {
    return this.config.managerRoles.includes(roleName);
  }

  /**
   * Check if role is employee role
   */
  isEmployeeRole(roleName: string): boolean {
    return this.config.employeeRoles.includes(roleName);
  }

  /**
   * Get default roles
   */
  getDefaultRoles(): string[] {
    return this.config.defaultRoles;
  }

  /**
   * Get admin roles
   */
  getAdminRoles(): string[] {
    return this.config.adminRoles;
  }

  /**
   * Get HR roles
   */
  getHRRoles(): string[] {
    return this.config.hrRoles;
  }

  /**
   * Get manager roles
   */
  getManagerRoles(): string[] {
    return this.config.managerRoles;
  }

  /**
   * Get employee roles
   */
  getEmployeeRoles(): string[] {
    return this.config.employeeRoles;
  }

  /**
   * Get role priority (lower number = higher priority)
   */
  getRolePriority(roleName: string): number {
    const role = this.getRole(roleName);
    return role ? role.priority : 999;
  }

  /**
   * Check if role has higher priority than another role
   */
  hasHigherPriority(role1: string, role2: string): boolean {
    return this.getRolePriority(role1) < this.getRolePriority(role2);
  }

  /**
   * Get all permissions for multiple roles
   */
  getMultipleRolesPermissions(roles: string[]): string[] {
    const allPermissions = new Set<string>();
    
    roles.forEach(role => {
      const rolePermissions = this.getRolePermissions(role);
      rolePermissions.forEach(permission => {
        allPermissions.add(permission);
      });
    });

    return Array.from(allPermissions);
  }

  /**
   * Validate permission format
   */
  isValidPermission(permission: string): boolean {
    const parts = permission.split('.');
    if (parts.length !== 2) {
      return false;
    }

    const [resource, action] = parts;
    if (!resource || !action) {
      return false;
    }
    const resourcePermissions = this.getPermission(resource);
    
    return Boolean(resourcePermissions && resourcePermissions[action] !== undefined);
  }

  /**
   * Get all available permissions as flat array
   */
  getAllPermissions(): string[] {
    const permissions: string[] = [];
    
    Object.keys(this.config.permissions).forEach(resource => {
      const resourcePerms = this.config.permissions[resource];
      if (resourcePerms) {
        Object.keys(resourcePerms).forEach(action => {
          permissions.push(`${resource}.${action}`);
        });
      }
    });

    return permissions;
  }

  /**
   * Reload configuration from file
   */
  reloadConfig(): void {
    this.loadConfig();
    this.logger.log('Roles and permissions configuration reloaded');
  }
}


