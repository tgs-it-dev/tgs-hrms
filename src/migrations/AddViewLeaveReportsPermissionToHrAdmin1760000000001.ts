import { MigrationInterface, QueryRunner } from "typeorm";
import { v4 as uuidv4 } from "uuid";

export class AddViewLeaveReportsPermissionToHrAdmin1760000000001 implements MigrationInterface {
  name = 'AddViewLeaveReportsPermissionToHrAdmin1760000000001'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add view_leave_reports permission if it doesn't exist
    await queryRunner.query(
      `INSERT INTO permissions (id, name, description) VALUES ($1, $2, $3)
       ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;`,
      [uuidv4(), 'view_leave_reports', 'View comprehensive leave reports'],
    );

    // 2. Get hr-admin role ID
    const hrAdminRole = await queryRunner.query(
      `SELECT id FROM roles WHERE name = 'hr-admin' LIMIT 1`,
    );
    
    if (!hrAdminRole.length) {
      throw new Error('HR Admin role not found');
    }

    // 3. Get view_leave_reports permission ID
    const permission = await queryRunner.query(
      `SELECT id FROM permissions WHERE name = 'view_leave_reports' LIMIT 1`,
    );
    
    if (!permission.length) {
      throw new Error('view_leave_reports permission not found');
    }

    // 4. Add permission to hr-admin role (if not already exists)
    const existingRolePermission = await queryRunner.query(
      `SELECT id FROM role_permissions WHERE role_id = $1 AND permission_id = $2`,
      [hrAdminRole[0].id, permission[0].id],
    );

    if (existingRolePermission.length === 0) {
      await queryRunner.query(
        `INSERT INTO role_permissions (id, role_id, permission_id) VALUES ($1, $2, $3);`,
        [uuidv4(), hrAdminRole[0].id, permission[0].id],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove the permission from hr-admin role
    await queryRunner.query(`
      DELETE FROM role_permissions 
      WHERE role_id = (SELECT id FROM roles WHERE name = 'hr-admin')
      AND permission_id = (SELECT id FROM permissions WHERE name = 'view_leave_reports')
    `);
  }
}
