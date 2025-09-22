import { MigrationInterface, QueryRunner } from "typeorm";
import { v4 as uuidv4 } from "uuid";

export class SeedRolesAndPermissionsUpdated1756000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Insert Roles
    const roles = [
      { name: "System-Admin", description: "Manage Everything" },
      { name: "Admin", description: "Administrator with full access" },
      { name: "Manager", description: "Manage a Team of Employees in a Department" },
      { name: "Employee", description: "Role for employee-level users" },
      { name: "User", description: "Basic user with limited access" },
    ];

    for (const role of roles) {
      await queryRunner.query(
        `INSERT INTO roles (id, name, description) VALUES ($1, $2, $3)
         ON CONFLICT (name) DO NOTHING;`,
        [uuidv4(), role.name, role.description],
      );
    }

    // 2. Insert Permissions (updated full set)
    const permissions = [
      { name: "manage_users", description: "manage users" },
      { name: "manage_roles", description: "manage roles" },
      { name: "manage_permissions", description: "manage permissions" },
      { name: "manage_departments", description: "manage departments" },
      { name: "manage_designations", description: "manage designations" },
      { name: "manage_policies", description: "manage policies" },
      { name: "view_reports", description: "view reports" },
      { name: "manage_tenants", description: "manage tenants" },
      { name: "manage_attendance", description: "manage attendance" },
      { name: "manage_leaves", description: "manage leaves" },
      { name: "manage_timesheets", description: "manage timesheets" },
      { name: "manage_employees", description: "manage employees" },
      { name: "approve_leaves", description: "approve leaves" },
      { name: "view_team_reports", description: "view team reports" },
      { name: "manage_team_schedules", description: "manage team schedules" },
      { name: "view_team_attendance", description: "view team attendance" },
      { name: "view_team_timesheets", description: "view team timesheets" },
      { name: "manage_team_leaves", description: "manage team leaves" },
      { name: "view_self_attendance", description: "view self attendance" },
      { name: "view_self_leaves", description: "view self leaves" },
      { name: "create_self_timesheet", description: "create self timesheet" },
      { name: "view_self_reports", description: "view self reports" },
      { name: "request_leave", description: "request leave" },
      { name: "view_self_schedule", description: "view self schedule" },
    ];

    for (const perm of permissions) {
      await queryRunner.query(
        `INSERT INTO permissions (id, name, description) VALUES ($1, $2, $3)
         ON CONFLICT (name) DO NOTHING;`,
        [uuidv4(), perm.name, perm.description],
      );
    }

    // 3. Role → Permissions Mapping (updated as per second migration)
    const rolePermissions: { role: string; permissions: string[] }[] = [
      {
        role: "System-Admin",
        permissions: [
          "manage_users", "manage_roles", "manage_permissions", "manage_departments",
          "manage_designations", "manage_policies", "view_reports", "manage_tenants",
          "manage_attendance", "manage_leaves", "manage_timesheets", "manage_employees",
          "approve_leaves", "view_team_reports", "manage_team_schedules"
        ],
      },
      {
        role: "Admin",
        permissions: [
            "manage_users", "manage_roles", "manage_permissions", "manage_departments",
            "manage_designations", "manage_policies", "view_reports", "manage_attendance", "manage_leaves", "manage_timesheets", "manage_employees",
            "approve_leaves", "view_team_reports", "manage_team_schedules"
        ],
      },
      {
        role: "Manager",
        permissions: [
          "view_reports", "manage_attendance", "manage_leaves", "manage_timesheets",
          "view_team_reports", "approve_leaves", "manage_team_schedules",
          "view_team_attendance", "view_team_timesheets", "manage_team_leaves"
        ],
      },
      {
        role: "Employee",
        permissions: [
          "view_self_attendance", "view_self_leaves", "create_self_timesheet",
          "view_self_reports", "request_leave", "view_self_schedule"
        ],
      },
      {
        role: "User",
        permissions: [
          "view_self_attendance", "view_self_leaves", "view_self_reports"
        ],
      },
    ];

    // Assign role → permissions
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

        await queryRunner.query(
          `INSERT INTO role_permissions (id, role_id, permission_id) VALUES ($1, $2, $3)
           ON CONFLICT DO NOTHING;`,
          [uuidv4(), role[0].id, perm[0].id],
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM role_permissions;`);
    await queryRunner.query(`DELETE FROM permissions;`);
    await queryRunner.query(`DELETE FROM roles;`);
  }
}
