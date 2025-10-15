import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveManageCompanyFromAdminRoles1760000000001
  implements MigrationInterface
{
  name = "RemoveManageCompanyFromAdminRoles1760000000001";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Remove manage_company permission from admin and network-admin roles
    await queryRunner.query(`
      DELETE FROM role_permissions 
      WHERE role_id IN (
        SELECT r.id FROM roles r WHERE r.name IN ('admin', 'network-admin')
      ) 
      AND permission_id IN (
        SELECT p.id FROM permissions p WHERE p.name = 'manage_company'
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore manage_company permission to admin and network-admin roles
    const roles = ["admin", "network-admin"];

    for (const roleName of roles) {
      // Get role ID
      const role = await queryRunner.query(
        `SELECT id FROM roles WHERE name = $1 LIMIT 1`,
        [roleName],
      );

      if (role.length === 0) continue;

      // Get permission ID
      const permission = await queryRunner.query(
        `SELECT id FROM permissions WHERE name = 'manage_company' LIMIT 1`,
      );

      if (permission.length === 0) continue;

      // Check if role-permission already exists to prevent duplicates
      const existingRolePermission = await queryRunner.query(
        `SELECT id FROM role_permissions WHERE role_id = $1 AND permission_id = $2`,
        [role[0].id, permission[0].id],
      );

      // Only insert if it doesn't already exist
      if (existingRolePermission.length === 0) {
        await queryRunner.query(
          `INSERT INTO role_permissions (id, role_id, permission_id) VALUES (uuid_generate_v4(), $1, $2)`,
          [role[0].id, permission[0].id],
        );
      }
    }
  }
}
