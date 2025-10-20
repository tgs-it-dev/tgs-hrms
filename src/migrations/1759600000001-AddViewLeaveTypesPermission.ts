import { MigrationInterface, QueryRunner } from "typeorm";
import { v4 as uuidv4 } from "uuid";

export class AddViewLeaveTypesPermission1759600000001 implements MigrationInterface {
  name = 'AddViewLeaveTypesPermission1759600000001'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Add view_leave_types permission
    await queryRunner.query(`
      INSERT INTO permissions (id, name, description)
      VALUES ($1, $2, $3)
      ON CONFLICT (name) DO NOTHING;
    `, [uuidv4(), 'view_leave_types', 'View leave types']);

    // 2) Fetch role IDs
    const rolesToGrant = ['Employee', 'Admin', 'network-admin', 'Manager', 'User'];
    const roleIds: Record<string, string> = {};
    for (const roleName of rolesToGrant) {
      const rows = await queryRunner.query(`SELECT id FROM roles WHERE name = $1`, [roleName]);
      if (rows.length > 0) roleIds[roleName] = rows[0].id;
    }

    // 3) Fetch permission ID
    const permRows = await queryRunner.query(`SELECT id FROM permissions WHERE name = 'view_leave_types'`);
    if (permRows.length === 0) return;
    const permId = permRows[0].id;

    // 4) Assign permission to each target role if missing
    for (const roleName of Object.keys(roleIds)) {
      const roleId = roleIds[roleName];
      const existing = await queryRunner.query(`
        SELECT id FROM role_permissions 
        WHERE role_id = $1 AND permission_id = $2
      `, [roleId, permId]);

      if (existing.length === 0) {
        await queryRunner.query(`
          INSERT INTO role_permissions (id, role_id, permission_id)
          VALUES ($1, $2, $3);
        `, [uuidv4(), roleId, permId]);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove role grants
    await queryRunner.query(`
      DELETE FROM role_permissions 
      WHERE permission_id IN (
        SELECT id FROM permissions WHERE name = 'view_leave_types'
      )
      AND role_id IN (
        SELECT id FROM roles WHERE name IN ('employee','admin','network-admin','manager','user')
      );
    `);

    // Remove permission
    await queryRunner.query(`
      DELETE FROM permissions WHERE name = 'view_leave_types';
    `);
  }
}