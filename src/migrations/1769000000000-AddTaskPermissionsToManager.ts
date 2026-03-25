import { MigrationInterface, QueryRunner } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

export class AddTaskPermissionsToManager1769000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Insert task permissions in JSON format (matching roles-permissions.json)
    const taskPermissions = [
      { name: 'task.create', description: 'Create new tasks' },
      { name: 'task.read', description: 'View task information' },
      { name: 'task.update', description: 'Update task information' },
      { name: 'task.delete', description: 'Delete tasks' },
    ];

    for (const perm of taskPermissions) {
      await queryRunner.query(
        `INSERT INTO permissions (id, name, description) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description`,
        [uuidv4(), perm.name, perm.description],
      );
    }

    // 2. Get manager role ID (case-insensitive)
    const managerRole = await queryRunner.query(
      `SELECT id FROM roles WHERE LOWER(name) = LOWER($1) LIMIT 1`,
      ['manager'],
    );

    if (!managerRole.length) {
      console.warn('Manager role not found. Skipping permission assignment.');
      return;
    }

    const managerRoleId = managerRole[0].id;

    // 3. Get task permission IDs
    const permissionIds: string[] = [];
    for (const perm of taskPermissions) {
      const permResult = await queryRunner.query(
        `SELECT id FROM permissions WHERE name = $1 LIMIT 1`,
        [perm.name],
      );
      if (permResult.length > 0) {
        permissionIds.push(permResult[0].id);
      }
    }

    // 4. Assign task permissions to manager role
    for (const permId of permissionIds) {
      await queryRunner.query(
        `INSERT INTO role_permissions (id, role_id, permission_id)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [uuidv4(), managerRoleId, permId],
      );
    }

    console.log('Task permissions added to manager role successfully');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Get manager role ID
    const managerRole = await queryRunner.query(
      `SELECT id FROM roles WHERE LOWER(name) = LOWER($1) LIMIT 1`,
      ['manager'],
    );

    if (!managerRole.length) {
      return;
    }

    const managerRoleId = managerRole[0].id;

    // Get task permission IDs
    const taskPermissionNames = ['task.create', 'task.read', 'task.update', 'task.delete'];
    const permissionIds: string[] = [];

    for (const permName of taskPermissionNames) {
      const permResult = await queryRunner.query(
        `SELECT id FROM permissions WHERE name = $1 LIMIT 1`,
        [permName],
      );
      if (permResult.length > 0) {
        permissionIds.push(permResult[0].id);
      }
    }

    // Remove task permissions from manager role
    if (permissionIds.length > 0) {
      await queryRunner.query(
        `DELETE FROM role_permissions 
         WHERE role_id = $1 AND permission_id = ANY($2::uuid[])`,
        [managerRoleId, permissionIds],
      );
    }

    // Optionally delete task permissions (commented out to preserve data)
    // for (const permName of taskPermissionNames) {
    //   await queryRunner.query(`DELETE FROM permissions WHERE name = $1`, [permName]);
    // }
  }
}
