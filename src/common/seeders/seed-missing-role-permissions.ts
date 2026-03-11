/**
 * 1. Seeds any MISSING permissions (from CSV export) into the permissions table.
 * 2. Then seeds only MISSING role_permissions (by role name + permission name).
 *
 * Run: npm run seed:role-permissions
 *
 * --- HOW TO FILL ROLE PERMISSIONS BELOW ---
 * Run this query on your DB to see what each role has:
 *   SELECT r.name AS role_name, array_agg(p.name ORDER BY p.name) AS permissions
 *   FROM role_permissions rp JOIN roles r ON r.id = rp.role_id
 *   JOIN permissions p ON p.id = rp.permission_id
 *   GROUP BY r.name ORDER BY r.name;
 * Copy the permissions array for each role into the section below.
 */
import { config } from 'dotenv';
import { DataSource } from 'typeorm';

config();

// -----------------------------------------------------------------------------
// Permissions from public_permissions_export (CSV). Inserted if missing (by name).
// -----------------------------------------------------------------------------
const PERMISSIONS_FROM_CSV: { name: string; description: string }[] = [
  { name: 'manage_users', description: 'manage users' },
  { name: 'manage_roles', description: 'manage roles' },
  { name: 'manage_permissions', description: 'manage permissions' },
  { name: 'manage_policies', description: 'manage policies' },
  { name: 'view_reports', description: 'view reports' },
  { name: 'manage_tenants', description: 'manage tenants' },
  { name: 'manage_attendance', description: 'manage attendance' },
  { name: 'manage_leaves', description: 'manage leaves' },
  { name: 'manage_timesheets', description: 'manage timesheets' },
  { name: 'manage_employees', description: 'manage employees' },
  { name: 'approve_leaves', description: 'approve leaves' },
  { name: 'view_team_reports', description: 'view team reports' },
  { name: 'manage_team_schedules', description: 'manage team schedules' },
  { name: 'view_team_attendance', description: 'view team attendance' },
  { name: 'view_team_timesheets', description: 'view team timesheets' },
  { name: 'manage_team_leaves', description: 'manage team leaves' },
  { name: 'view_self_attendance', description: 'view self attendance' },
  { name: 'view_self_leaves', description: 'view self leaves' },
  { name: 'create_self_timesheet', description: 'create self timesheet' },
  { name: 'view_self_reports', description: 'view self reports' },
  { name: 'request_leave', description: 'request leave' },
  { name: 'view_self_schedule', description: 'view self schedule' },
  { name: 'manage_company', description: 'manage company details' },
  { name: 'manage_leave_types', description: 'Manage leave types' },
  { name: 'view_leave_types', description: 'View leave types' },
  { name: 'view_leave_reports', description: 'View comprehensive leave reports' },
  { name: 'task.create', description: 'Create new tasks' },
  { name: 'task.read', description: 'View task information' },
  { name: 'task.update', description: 'Update task information' },
  { name: 'task.delete', description: 'Delete tasks' },
  { name: 'manage_departments', description: 'manage departments' },
  { name: 'manage_designations', description: 'manage designations' },
  { name: 'manage_geofences', description: 'manage geofences' },
  { name: 'announcement.create', description: 'Create announcements' },
  { name: 'announcement.read', description: 'View announcements' },
  { name: 'announcement.update', description: 'Update announcements' },
  { name: 'announcement.delete', description: 'Delete announcements' },
  { name: 'announcement.send', description: 'Send announcement emails' },
  { name: 'asset.create', description: 'Create assets' },
  { name: 'asset.read', description: 'View asset information' },
  { name: 'asset.update', description: 'Update assets' },
  { name: 'asset.delete', description: 'Delete assets' },
  { name: 'asset.assign', description: 'Assign assets to employees' },
  { name: 'asset.unassign', description: 'Unassign assets from employees' },
  { name: 'asset-request.create', description: 'Create asset requests' },
  { name: 'asset-request.read', description: 'View asset request information' },
  { name: 'asset-request.update', description: 'Update asset requests' },
  { name: 'asset-request.delete', description: 'Delete asset requests' },
  { name: 'asset-request.approve', description: 'Approve asset requests' },
  { name: 'asset-request.reject', description: 'Reject asset requests' },
];

// -----------------------------------------------------------------------------
// Paste from your DB query result (one array per role). Use lowercase key.
// Key = role name in lowercase; value = array of permission names.
// -----------------------------------------------------------------------------

const systemAdminPermissions: string[] = [
  'announcement.create',
  'announcement.delete',
  'announcement.read',
  'announcement.send',
  'announcement.update',
  'approve_leaves',
  'asset.assign',
  'asset.create',
  'asset.delete',
  'asset.read',
  'asset-request.approve',
  'asset-request.read',
  'asset-request.reject',
  'asset.unassign',
  'asset.update',
  'manage_attendance',
  'manage_company',
  'manage_departments',
  'manage_designations',
  'manage_employees',
  'manage_geofences',
  'manage_leaves',
  'manage_permissions',
  'manage_policies',
  'manage_roles',
  'manage_team_schedules',
  'manage_tenants',
  'manage_timesheets',
  'manage_users',
  'view_reports',
  'view_team_reports',
];

const adminPermissions: string[] = [
  'announcement.create',
  'announcement.delete',
  'announcement.read',
  'announcement.send',
  'announcement.update',
  'approve_leaves',
  'asset.assign',
  'asset.create',
  'asset.delete',
  'asset.read',
  'asset-request.approve',
  'asset-request.read',
  'asset-request.reject',
  'asset.unassign',
  'asset.update',
  'manage_attendance',
  'manage_company',
  'manage_departments',
  'manage_designations',
  'manage_employees',
  'manage_geofences',
  'manage_leaves',
  'manage_permissions',
  'manage_policies',
  'manage_roles',
  'manage_team_schedules',
  'manage_timesheets',
  'manage_users',
  'view_leave_types',
  'view_reports',
  'view_team_reports',
];

const networkAdminPermissions: string[] = [
  'approve_leaves',
  'create_self_timesheet',
  'manage_attendance',
  'manage_departments',
  'manage_designations',
  'manage_employees',
  'manage_geofences',
  'manage_leaves',
  'manage_permissions',
  'manage_policies',
  'manage_roles',
  'manage_team_leaves',
  'manage_team_schedules',
  'manage_timesheets',
  'manage_users',
  'request_leave',
  'view_leave_types',
  'view_reports',
  'view_self_attendance',
  'view_self_leaves',
  'view_self_reports',
  'view_self_schedule',
  'view_team_attendance',
  'view_team_reports',
  'view_team_timesheets',
];

const hrAdminPermissions: string[] = [
  'announcement.create',
  'announcement.delete',
  'announcement.read',
  'announcement.send',
  'announcement.update',
  'asset.create',
  'asset.read',
  'asset-request.approve',
  'asset-request.read',
  'asset-request.reject',
  'create_self_timesheet',
  'manage_attendance',
  'manage_departments',
  'manage_designations',
  'manage_employees',
  'manage_geofences',
  'manage_leaves',
  'manage_leave_types',
  'manage_roles',
  'request_leave',
  'view_leave_reports',
  'view_self_attendance',
  'view_self_leaves',
  'view_self_reports',
  'view_self_schedule',
];

const managerPermissions: string[] = [
  'approve_leaves',
  'asset-request.create',
  'asset-request.read',
  'manage_attendance',
  'manage_departments',
  'manage_designations',
  'manage_geofences',
  'manage_leaves',
  'manage_team_leaves',
  'manage_team_schedules',
  'manage_timesheets',
  'task.create',
  'task.delete',
  'task.read',
  'task.update',
  'view_leave_types',
  'view_reports',
  'view_team_attendance',
  'view_team_reports',
  'view_team_timesheets',
];

const employeePermissions: string[] = [
  'asset-request.create',
  'asset-request.read',
  'create_self_timesheet',
  'request_leave',
  'view_leave_types',
  'view_self_attendance',
  'view_self_leaves',
  'view_self_reports',
  'view_self_schedule',
];

const userPermissions: string[] = [
  'request_leave',
  'view_leave_types',
  'view_self_attendance',
  'view_self_leaves',
  'view_self_reports',
];

// -----------------------------------------------------------------------------
// Script logic (no need to edit below)
// -----------------------------------------------------------------------------

const roleToPermissions: Record<string, string[]> = {
  'system-admin': systemAdminPermissions,
  admin: adminPermissions,
  'network-admin': networkAdminPermissions,
  'hr-admin': hrAdminPermissions,
  manager: managerPermissions,
  employee: employeePermissions,
  user: userPermissions,
};

async function run() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || 'password',
    database: process.env.DB_NAME || 'tgs_hrms',
    synchronize: false,
    logging: false,
  });

  try {
    await dataSource.initialize();
    console.log('[seed-missing-role-permissions] Connected to DB');

    // 1. Insert any missing permissions (from CSV). ON CONFLICT (name) DO NOTHING.
    let permissionsInserted = 0;
    for (const p of PERMISSIONS_FROM_CSV) {
      const inserted: { id: string }[] = await dataSource.query(
        `INSERT INTO permissions (id, name, description) VALUES (uuid_generate_v4(), $1, $2)
         ON CONFLICT (name) DO NOTHING RETURNING id`,
        [p.name, p.description],
      );
      if (inserted.length > 0) permissionsInserted++;
    }
    if (permissionsInserted > 0) {
      console.log(`[seed-missing-role-permissions] Inserted ${permissionsInserted} missing permission(s).`);
    }

    const roleRows: { id: string; name: string }[] = await dataSource.query(`SELECT id, name FROM roles`);
    const permRows: { id: string; name: string }[] = await dataSource.query(`SELECT id, name FROM permissions`);

    const roleIdByNormalizedName = new Map<string, string>();
    for (const r of roleRows) {
      const key = (r.name || '').toLowerCase().trim();
      if (key) roleIdByNormalizedName.set(key, r.id);
    }

    const permIdByName = new Map<string, string>();
    for (const p of permRows) {
      if (p.name) permIdByName.set(p.name, p.id);
    }

    let inserted = 0;
    let skipped = 0;
    const missingRoles: string[] = [];
    const missingPerms = new Set<string>();

    for (const [roleKey, permissionNames] of Object.entries(roleToPermissions)) {
      const roleId = roleIdByNormalizedName.get(roleKey);
      if (!roleId) {
        missingRoles.push(roleKey);
        continue;
      }

      for (const permName of permissionNames) {
        const permId = permIdByName.get(permName);
        if (!permId) {
          missingPerms.add(permName);
          continue;
        }

        const existing: { count: string }[] = await dataSource.query(
          `SELECT 1 as count FROM role_permissions WHERE role_id = $1 AND permission_id = $2 LIMIT 1`,
          [roleId, permId],
        );

        if (existing.length > 0) {
          skipped++;
          continue;
        }

        await dataSource.query(
          `INSERT INTO role_permissions (id, role_id, permission_id) VALUES (uuid_generate_v4(), $1, $2)`,
          [roleId, permId],
        );
        inserted++;
      }
    }

    if (missingRoles.length) {
      console.warn('[seed-missing-role-permissions] Roles not found in DB (skipped):', missingRoles.join(', '));
    }
    if (missingPerms.size) {
      console.warn(
        '[seed-missing-role-permissions] Permissions not found in DB (skipped):',
        [...missingPerms].sort().join(', '),
      );
    }

    console.log(`[seed-missing-role-permissions] Done. Inserted: ${inserted}, Already existed: ${skipped}`);
  } catch (err) {
    console.error('[seed-missing-role-permissions] Error:', err);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

void run();
