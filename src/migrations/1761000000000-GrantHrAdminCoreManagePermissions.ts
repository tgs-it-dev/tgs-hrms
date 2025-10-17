import { MigrationInterface, QueryRunner } from "typeorm";
import { v4 as uuidv4 } from "uuid";

export class GrantHrAdminCoreManagePermissions1761000000000 implements MigrationInterface {
  name = 'GrantHrAdminCoreManagePermissions1761000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure the permissions exist (idempotent)
    const targetPermissions: { name: string; description: string }[] = [
      { name: 'manage_employees', description: 'Manage employees' },
      { name: 'manage_roles', description: 'Manage roles' },
      { name: 'manage_departments', description: 'Manage departments' },
      { name: 'manage_designations', description: 'Manage designations' },
    ];

    for (const perm of targetPermissions) {
      await queryRunner.query(
        `INSERT INTO permissions (id, name, description)
         VALUES ($1, $2, $3)
         ON CONFLICT (name) DO NOTHING;`,
        [uuidv4(), perm.name, perm.description],
      );
    }

    // Get hr-admin role id
    const hrAdminRole = await queryRunner.query(
      `SELECT id FROM roles WHERE name = $1 LIMIT 1`,
      ['hr-admin'],
    );

    if (!hrAdminRole.length) {
      // If role doesn't exist, nothing to do; keep migration safe to run
      return;
    }

    const roleId = hrAdminRole[0].id;

    for (const perm of targetPermissions) {
      const permission = await queryRunner.query(
        `SELECT id FROM permissions WHERE name = $1 LIMIT 1`,
        [perm.name],
      );

      if (!permission.length) continue;

      const permissionId = permission[0].id;

      // Check existing mapping
      const existing = await queryRunner.query(
        `SELECT id FROM role_permissions WHERE role_id = $1 AND permission_id = $2`,
        [roleId, permissionId],
      );

      if (existing.length === 0) {
        await queryRunner.query(
          `INSERT INTO role_permissions (id, role_id, permission_id) VALUES ($1, $2, $3);`,
          [uuidv4(), roleId, permissionId],
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert the role-permission mappings for hr-admin only
    const hrAdminRole = await queryRunner.query(
      `SELECT id FROM roles WHERE name = $1 LIMIT 1`,
      ['hr-admin'],
    );

    if (!hrAdminRole.length) {
      return;
    }

    const roleId = hrAdminRole[0].id;

    const targetPermissionNames = [
      'manage_employees',
      'manage_roles',
      'manage_departments',
      'manage_designations',
    ];

    for (const permName of targetPermissionNames) {
      const permission = await queryRunner.query(
        `SELECT id FROM permissions WHERE name = $1 LIMIT 1`,
        [permName],
      );
      if (!permission.length) continue;

      const permissionId = permission[0].id;

      await queryRunner.query(
        `DELETE FROM role_permissions WHERE role_id = $1 AND permission_id = $2`,
        [roleId, permissionId],
      );
    }
  }
}


