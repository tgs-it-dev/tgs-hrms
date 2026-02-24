import { DataSource } from 'typeorm';
import { Logger } from '@nestjs/common';

export async function seedRolesAndPermissions(dataSource: DataSource) {
  const logger = new Logger('RolesAndPermissionsSeeder');

  try {
    logger.log('Starting to seed roles and permissions...');

    const permissions = [
      'manage_users',
      'manage_roles',
      'manage_permissions',
      'manage_departments',
      'manage_designations',
      'manage_geofences',
      'manage_policies',
      'view_reports',
      'manage_tenants',
      'manage_attendance',
      'manage_leaves',
      'manage_timesheets',
      'manage_employees',
      'approve_leaves',
      'view_team_reports',
      'manage_team_schedules',
      'view_team_attendance',
      'view_team_timesheets',
      'manage_team_leaves',
      'view_self_reports',
      'request_leave',
      'view_self_schedule',
      'view_self_attendance',
      'view_self_leaves',
      'create_self_timesheet',
      'create_self_attendance',
      'manage_company',
      'task.create',
      'task.read',
      'task.update',
      'task.delete',
    ];

    for (const permission of permissions) {
      await dataSource.query(
        `INSERT INTO permissions (id, name, description) 
         VALUES (uuid_generate_v4(), $1, $2) 
         ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description`,
        [permission, permission.replace(/_/g, ' ')],
      );
      logger.log(`Inserted/Updated permission: ${permission}`);
    }

    interface RoleRow {
      id: string;
      name: string;
    }
    interface PermissionRow {
      id: string;
      name: string;
    }

    const roleRows = await dataSource.query<RoleRow[]>('SELECT id, name FROM roles');
    const permissionRows = await dataSource.query<PermissionRow[]>('SELECT id, name FROM permissions');

    if (!Array.isArray(roleRows) || !Array.isArray(permissionRows)) {
      throw new Error('Seed query returned unexpected result shape (expected arrays)');
    }

    const roleNameToId = new Map(roleRows.map((r) => [r.name, r.id] as const));
    const permNameToId = new Map(permissionRows.map((p) => [p.name, p.id] as const));

    const roleToPermissions: Record<string, string[]> = {
      'system-admin': [
        'manage_users',
        'manage_roles',
        'manage_permissions',
        'manage_departments',
        'manage_designations',
        'manage_geofences',
        'manage_policies',
        'view_reports',
        'manage_tenants',
        'manage_attendance',
        'manage_leaves',
        'manage_timesheets',
        'manage_employees',
        'approve_leaves',
        'view_team_reports',
        'manage_team_schedules',
        'view_team_attendance',
        'view_team_timesheets',
        'manage_team_leaves',
        'view_self_attendance',
        'view_self_leaves',
        'create_self_timesheet',
        'view_self_reports',
        'request_leave',
        'view_self_schedule',
        'manage_company',
      ],
      admin: [
        'manage_users',
        'manage_roles',
        'manage_permissions',
        'manage_departments',
        'manage_designations',
        'manage_geofences',
        'manage_policies',
        'view_reports',
        'manage_attendance',
        'manage_leaves',
        'manage_timesheets',
        'manage_employees',
        'approve_leaves',
        'view_team_reports',
        'manage_team_schedules',
        'view_team_attendance',
        'view_team_timesheets',
        'manage_team_leaves',
        'view_self_attendance',
        'view_self_leaves',
        'create_self_timesheet',
        'view_self_reports',
        'request_leave',
        'view_self_schedule',
        'manage_company',
      ],
      'network-admin': [
        'manage_users',
        'manage_roles',
        'manage_permissions',
        'manage_departments',
        'manage_designations',
        'manage_geofences',
        'manage_policies',
        'view_reports',
        'manage_attendance',
        'manage_leaves',
        'manage_timesheets',
        'manage_employees',
        'approve_leaves',
        'view_team_reports',
        'manage_team_schedules',
        'view_team_attendance',
        'view_team_timesheets',
        'manage_team_leaves',
        'view_self_attendance',
        'view_self_leaves',
        'create_self_timesheet',
        'view_self_reports',
        'request_leave',
        'view_self_schedule',
        'manage_company',
      ],
      'hr-admin': [
        'view_self_attendance',
        'view_self_leaves',
        'create_self_timesheet',
        'view_self_reports',
        'request_leave',
        'view_self_schedule',
        'manage_attendance',
        'create_self_attendance',
        'manage_leaves',
        'manage_geofences',
      ],
      manager: [
        'view_reports',
        'manage_departments',
        'manage_designations',
        'manage_attendance',
        'manage_leaves',
        'manage_timesheets',
        'view_team_reports',
        'approve_leaves',
        'manage_team_schedules',
        'view_team_attendance',
        'view_team_timesheets',
        'manage_team_leaves',
        'task.create',
        'task.read',
        'task.update',
        'task.delete',
      ],
      employee: [
        'view_self_attendance',
        'view_self_leaves',
        'create_self_timesheet',
        'view_self_reports',
        'request_leave',
        'view_self_schedule',
      ],
      user: ['view_self_attendance', 'view_self_leaves', 'view_self_reports'],
    };

    await dataSource.query('DELETE FROM role_permissions');
    logger.log('Cleared existing role_permissions');

    for (const [roleName, perms] of Object.entries(roleToPermissions)) {
      const roleId = roleNameToId.get(roleName);
      if (!roleId) {
        logger.warn(`Role not found: ${roleName}`);
        continue;
      }

      for (const perm of perms) {
        const permId = permNameToId.get(perm);
        if (!permId) {
          logger.warn(`Permission not found: ${perm}`);
          continue;
        }

        await dataSource.query(
          `INSERT INTO role_permissions (id, role_id, permission_id)
           VALUES (uuid_generate_v4(), $1, $2)`,
          [roleId, permId],
        );
      }
      logger.log(`Inserted permissions for role: ${roleName}`);
    }

    logger.log('Successfully seeded roles and permissions!');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to seed roles and permissions: ${errorMessage}`);
    throw error;
  }
}
