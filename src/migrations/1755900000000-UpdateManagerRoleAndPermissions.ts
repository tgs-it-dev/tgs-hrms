import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateManagerRoleAndPermissions1755900000000 implements MigrationInterface {
    name = 'UpdateManagerRoleAndPermissions1755900000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Define comprehensive permissions for all roles
        const roleToPermissions: Record<string, string[]> = {
            'System-Admin': [
                'manage_users', 'manage_roles', 'manage_permissions', 'manage_departments', 
                'manage_designations', 'manage_policies', 'view_reports', 'manage_tenants', 
                'manage_attendance', 'manage_leaves', 'manage_timesheets', 'manage_employees',
                'approve_leaves', 'view_team_reports', 'manage_team_schedules'
            ],
            'Admin': [
                'manage_users', 'manage_departments', 'manage_designations', 'manage_policies', 
                'view_reports', 'manage_attendance', 'manage_leaves', 'manage_timesheets', 
                'manage_employees', 'approve_leaves', 'view_team_reports', 'manage_team_schedules'
            ],
            'Manager': [
                'view_reports', 'manage_attendance', 'manage_leaves', 'manage_timesheets',
                'view_team_reports', 'approve_leaves', 'manage_team_schedules', 'view_team_attendance',
                'view_team_timesheets', 'manage_team_leaves'
            ],
            'Employee': [
                'view_self_attendance', 'view_self_leaves', 'create_self_timesheet',
                'view_self_reports', 'request_leave', 'view_self_schedule'
            ],
            'User': [
                'view_self_attendance', 'view_self_leaves', 'view_self_reports'
            ],
        };

        // Insert new permissions if not exists
        const allPermissions = Array.from(new Set(Object.values(roleToPermissions).flat()));
        for (const perm of allPermissions) {
            await queryRunner.query(
                `INSERT INTO permissions (id, name, description)
                 VALUES (uuid_generate_v4(), $1, $2)
                 ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description`,
                 [perm, perm.replace(/_/g,' ')]
            );
        }

        // Load permission ids
        const permissionRows: { id: string, name: string }[] = await queryRunner.query(`SELECT id, name FROM permissions`);
        const permNameToId = new Map(permissionRows.map(r => [r.name, r.id] as const));

        // For each role by name, create/update role_permissions entries
        const roleRows: { id: string, name: string }[] = await queryRunner.query(`SELECT id, name FROM roles`);
        const roleNameToId = new Map(roleRows.map(r => [r.name, r.id] as const)); // Use exact case

        // Clear existing role_permissions for clean slate
        await queryRunner.query(`DELETE FROM role_permissions`);

        // Insert new role_permissions for all roles
        for (const [roleName, perms] of Object.entries(roleToPermissions)) {
            const roleId = roleNameToId.get(roleName);
            if (!roleId) {
                console.log(`Role not found: ${roleName}, available roles: ${Array.from(roleNameToId.keys()).join(', ')}`);
                continue; // skip if role not present
            }
            
            for (const perm of perms) {
                const permId = permNameToId.get(perm);
                if (!permId) continue;
                
                await queryRunner.query(
                    `INSERT INTO role_permissions (id, role_id, permission_id)
                     VALUES (uuid_generate_v4(), $1, $2)`,
                    [roleId, permId]
                );
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove all role_permissions and permissions we added
        const allPermissions = [
            'manage_users', 'manage_roles', 'manage_permissions', 'manage_departments', 
            'manage_designations', 'manage_policies', 'view_reports', 'manage_tenants', 
            'manage_attendance', 'manage_leaves', 'manage_timesheets', 'manage_employees',
            'approve_leaves', 'view_team_reports', 'manage_team_schedules', 'view_team_attendance',
            'view_team_timesheets', 'manage_team_leaves', 'view_self_reports', 'request_leave',
            'view_self_schedule'
        ];

        await queryRunner.query(
            `DELETE FROM role_permissions WHERE permission_id IN (
                SELECT id FROM permissions WHERE name = ANY($1)
            )`,
            [allPermissions]
        );

        await queryRunner.query(
            `DELETE FROM permissions WHERE name = ANY($1)`,
            [allPermissions]
        );
    }
}


