import { MigrationInterface, QueryRunner } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

export class AddManageGeofencesPermission1771200000001 implements MigrationInterface {
  name = 'AddManageGeofencesPermission1771200000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Ensure permission exists (idempotent)
    await queryRunner.query(
      `INSERT INTO permissions (id, name, description)
       VALUES ($1, $2, $3)
       ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description`,
      [uuidv4(), 'manage_geofences', 'manage geofences'],
    );

    // 2) Get permission id
    const perm = await queryRunner.query(
      `SELECT id FROM permissions WHERE name = $1 LIMIT 1`,
      ['manage_geofences'],
    );
    if (!perm.length) return;
    const permissionId = perm[0].id;

    // 3) Assign permission to roles (idempotent)
    const targetRoles = ['system-admin', 'admin', 'network-admin', 'hr-admin', 'manager'];

    for (const roleName of targetRoles) {
      const role = await queryRunner.query(
        `SELECT id FROM roles WHERE LOWER(name) = LOWER($1) LIMIT 1`,
        [roleName],
      );
      if (!role.length) continue;

      await queryRunner.query(
        `INSERT INTO role_permissions (id, role_id, permission_id)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [uuidv4(), role[0].id, permissionId],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const perm = await queryRunner.query(
      `SELECT id FROM permissions WHERE name = $1 LIMIT 1`,
      ['manage_geofences'],
    );
    if (!perm.length) return;

    const permissionId = perm[0].id;
    const targetRoles = ['system-admin', 'admin', 'network-admin', 'hr-admin', 'manager'];

    for (const roleName of targetRoles) {
      const role = await queryRunner.query(
        `SELECT id FROM roles WHERE LOWER(name) = LOWER($1) LIMIT 1`,
        [roleName],
      );
      if (!role.length) continue;

      await queryRunner.query(
        `DELETE FROM role_permissions WHERE role_id = $1 AND permission_id = $2`,
        [role[0].id, permissionId],
      );
    }
  }
}

