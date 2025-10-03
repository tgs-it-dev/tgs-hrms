import { MigrationInterface, QueryRunner } from "typeorm";
import { v4 as uuidv4 } from "uuid";

export class AddHrAdminAndNetworkAdminRoles1760000000000 implements MigrationInterface {
  name = 'AddHrAdminAndNetworkAdminRoles1760000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Insert only hr-admin and network-admin roles
    const roles = [
      { name: "hr-admin", description: "HR administrator with employee and attendance management" },
      { name: "network-admin", description: "Network administrator with same permissions as admin" },
    ];

    for (const role of roles) {
      await queryRunner.query(
        `INSERT INTO roles (id, name, description) VALUES ($1, $2, $3)
         ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;`,
        [uuidv4(), role.name, role.description],
      );
    }

    // 2. Role → Permissions Mapping for new roles only
    const rolePermissions: { role: string; permissions: string[] }[] = [
      {
        role: "hr-admin",
        permissions: [
          "view_self_attendance", "view_self_leaves", "create_self_timesheet", "view_self_reports",
          "request_leave", "view_self_schedule", "manage_attendance", "create_self_attendance",
          "manage_leaves"
        ],
      },
      {
        role: "network-admin",
        permissions: [
          "manage_users", "manage_roles", "manage_permissions", "manage_departments",
          "manage_designations", "manage_policies", "view_reports", "manage_attendance",
          "manage_leaves", "manage_timesheets", "manage_employees", "approve_leaves",
          "view_team_reports", "manage_team_schedules", "view_team_attendance", "view_team_timesheets",
          "manage_team_leaves", "view_self_attendance", "view_self_leaves", "create_self_timesheet",
          "view_self_reports", "request_leave", "view_self_schedule", "manage_company"
        ],
      },
    ];

    // Assign role → permissions for new roles only
    for (const rp of rolePermissions) {
      const role = await queryRunner.query(
        `SELECT id FROM roles WHERE name = $1 LIMIT 1`,
        [rp.role],
      );
      if (!role.length) continue;

      for (const permName of rp.permissions) {
        const perm = await queryRunner.query(
          `SELECT id FROM permissions WHERE name = $1 LIMIT 1`,
          [permName],
        );
        if (!perm.length) continue;

        // Check if role-permission already exists
        const existingRolePermission = await queryRunner.query(
          `SELECT id FROM role_permissions WHERE role_id = $1 AND permission_id = $2`,
          [role[0].id, perm[0].id],
        );

        if (existingRolePermission.length === 0) {
          await queryRunner.query(
            `INSERT INTO role_permissions (id, role_id, permission_id) VALUES ($1, $2, $3);`,
            [uuidv4(), role[0].id, perm[0].id],
          );
        }
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove role_permissions for hr-admin and network-admin
    await queryRunner.query(`
      DELETE FROM role_permissions 
      WHERE role_id IN (
        SELECT id FROM roles WHERE name IN ('hr-admin', 'network-admin')
      )
    `);
    
    // Remove hr-admin and network-admin roles
    await queryRunner.query(`DELETE FROM roles WHERE name IN ('hr-admin', 'network-admin');`);
  }
}
