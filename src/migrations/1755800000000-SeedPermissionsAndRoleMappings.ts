import { MigrationInterface, QueryRunner } from "typeorm";

export class SeedPermissionsAndRoleMappings1755800000000 implements MigrationInterface {
    name = 'SeedPermissionsAndRoleMappings1755800000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Define permissions grouped by role
        const roleToPermissions: Record<string, string[]> = {
            'system-admin': [
                'manage_users','manage_roles','manage_permissions','manage_departments','manage_designations','manage_policies','view_reports','manage_tenants','manage_attendance','manage_leaves','manage_timesheets'
            ],
            'admin': [
                'manage_users','manage_departments','manage_designations','manage_policies','view_reports','manage_attendance','manage_leaves','manage_timesheets'
            ],
            'manager': [
                'view_reports','manage_attendance','manage_leaves','manage_timesheets'
            ],
            'employee': [
                'view_self_attendance','view_self_leaves','create_self_timesheet'
            ],
        };

        // Insert permissions if not exists
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

        // For each role by name, create role_permissions entries
        const roleRows: { id: string, name: string }[] = await queryRunner.query(`SELECT id, name FROM roles`);
        const roleNameToId = new Map(roleRows.map(r => [r.name.toLowerCase(), r.id] as const));

        for (const [roleName, perms] of Object.entries(roleToPermissions)) {
            const roleId = roleNameToId.get(roleName);
            if (!roleId) continue; // skip if role not present
            for (const perm of perms) {
                const permId = permNameToId.get(perm);
                if (!permId) continue;
                await queryRunner.query(
                    `INSERT INTO role_permissions (id, role_id, permission_id)
                     VALUES (uuid_generate_v4(), $1, $2)
                     ON CONFLICT DO NOTHING`,
                    [roleId, permId]
                );
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Optionally remove only the seeded mappings and permissions
        // Safer approach: delete role_permissions for the permissions we added, then delete those permissions
        const seeded = [
            'manage_users','manage_roles','manage_permissions','manage_departments','manage_designations','manage_policies','view_reports','manage_tenants','manage_attendance','manage_leaves','manage_timesheets',
            'view_self_attendance','view_self_leaves','create_self_timesheet'
        ];

        await queryRunner.query(
            `DELETE FROM role_permissions WHERE permission_id IN (
                SELECT id FROM permissions WHERE name = ANY($1)
            )`,
            [seeded]
        );

        await queryRunner.query(
            `DELETE FROM permissions WHERE name = ANY($1)`,
            [seeded]
        );
    }
}


