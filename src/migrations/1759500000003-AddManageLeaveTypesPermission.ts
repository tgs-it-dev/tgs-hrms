import { MigrationInterface, QueryRunner } from "typeorm";
import { v4 as uuidv4 } from "uuid";

export class AddManageLeaveTypesPermission1759500000003 implements MigrationInterface {
  name = 'AddManageLeaveTypesPermission1759500000003'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add manage_leave_types permission
    await queryRunner.query(`
      INSERT INTO permissions (id, name, description) 
      VALUES ($1, $2, $3)
      ON CONFLICT (name) DO NOTHING;
    `, [uuidv4(), 'manage_leave_types', 'Manage leave types']);

    // Get hr-admin and system-admin role IDs
    const hrAdminRole = await queryRunner.query(`SELECT id FROM roles WHERE name = 'hr-admin'`);
    const systemAdminRole = await queryRunner.query(`SELECT id FROM roles WHERE name = 'system-admin'`);
    const adminRole = await queryRunner.query(`SELECT id FROM roles WHERE name = 'admin'`);
    const manageLeaveTypesPermission = await queryRunner.query(`SELECT id FROM permissions WHERE name = 'manage_leave_types'`);

    if (hrAdminRole.length > 0 && manageLeaveTypesPermission.length > 0) {
      // Check if permission already exists for hr-admin role
      const existingHrAdminPermission = await queryRunner.query(`
        SELECT id FROM role_permissions 
        WHERE role_id = $1 AND permission_id = $2
      `, [hrAdminRole[0].id, manageLeaveTypesPermission[0].id]);

      if (existingHrAdminPermission.length === 0) {
        // Add permission to hr-admin role
        await queryRunner.query(`
          INSERT INTO role_permissions (id, role_id, permission_id) 
          VALUES ($1, $2, $3);
        `, [uuidv4(), hrAdminRole[0].id, manageLeaveTypesPermission[0].id]);
      }
    }

    if (systemAdminRole.length > 0 && manageLeaveTypesPermission.length > 0) {
      // Check if permission already exists for system-admin role
      const existingSystemAdminPermission = await queryRunner.query(`
        SELECT id FROM role_permissions 
        WHERE role_id = $1 AND permission_id = $2
      `, [systemAdminRole[0].id, manageLeaveTypesPermission[0].id]);

      if (existingSystemAdminPermission.length === 0) {
        // Add permission to system-admin role
        await queryRunner.query(`
          INSERT INTO role_permissions (id, role_id, permission_id) 
          VALUES ($1, $2, $3);
        `, [uuidv4(), systemAdminRole[0].id, manageLeaveTypesPermission[0].id]);
      }
    }

    if (adminRole.length > 0 && manageLeaveTypesPermission.length > 0) {
      // Check if permission already exists for admin role
      const existingAdminPermission = await queryRunner.query(`
        SELECT id FROM role_permissions 
        WHERE role_id = $1 AND permission_id = $2
      `, [adminRole[0].id, manageLeaveTypesPermission[0].id]);

      if (existingAdminPermission.length === 0) {
        // Add permission to admin role
        await queryRunner.query(`
          INSERT INTO role_permissions (id, role_id, permission_id) 
          VALUES ($1, $2, $3);
        `, [uuidv4(), adminRole[0].id, manageLeaveTypesPermission[0].id]);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove permission from all roles
    await queryRunner.query(`
      DELETE FROM role_permissions 
      WHERE permission_id IN (
        SELECT id FROM permissions WHERE name = 'manage_leave_types'
      );
    `);

    // Remove the permission
    await queryRunner.query(`
      DELETE FROM permissions WHERE name = 'manage_leave_types';
    `);
  }
}
