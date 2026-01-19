import { MigrationInterface, QueryRunner } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

export class AddManageDepartmentsPermissionToManager1771100000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Ensure permission exists (idempotent)
    await queryRunner.query(
      `INSERT INTO permissions (id, name, description)
       VALUES ($1, $2, $3)
       ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description`,
      [uuidv4(), 'manage_departments', 'manage departments'],
    );

    // 2) Get manager role id (case-insensitive)
    const managerRole = await queryRunner.query(
      `SELECT id FROM roles WHERE LOWER(name) = LOWER($1) LIMIT 1`,
      ['manager'],
    );

    if (!managerRole.length) {
      // Safe no-op if manager role doesn't exist in this environment
      return;
    }

    const managerRoleId = managerRole[0].id;

    // 3) Get permission id
    const perm = await queryRunner.query(
      `SELECT id FROM permissions WHERE name = $1 LIMIT 1`,
      ['manage_departments'],
    );

    if (!perm.length) return;

    const permissionId = perm[0].id;

    // 4) Assign permission to manager (idempotent)
    await queryRunner.query(
      `INSERT INTO role_permissions (id, role_id, permission_id)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [uuidv4(), managerRoleId, permissionId],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const managerRole = await queryRunner.query(
      `SELECT id FROM roles WHERE LOWER(name) = LOWER($1) LIMIT 1`,
      ['manager'],
    );
    if (!managerRole.length) return;

    const perm = await queryRunner.query(
      `SELECT id FROM permissions WHERE name = $1 LIMIT 1`,
      ['manage_departments'],
    );
    if (!perm.length) return;

    await queryRunner.query(
      `DELETE FROM role_permissions WHERE role_id = $1 AND permission_id = $2`,
      [managerRole[0].id, perm[0].id],
    );
  }
}

