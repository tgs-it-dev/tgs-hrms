import { MigrationInterface, QueryRunner } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
export class InsertDummyRecords1699999999999 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const tenantId = uuidv4();
    const roleId = uuidv4();
    const permissionId = uuidv4();
    const rolePermissionId = uuidv4();
    const userId = uuidv4();
    const departmentId = uuidv4();
    const designationId = uuidv4();
    const employeeId = uuidv4();
    // Insert Tenant
    await queryRunner.query(`
      INSERT INTO tenants (id, name, created_at)
      VALUES ('${tenantId}', 'Acme Corp', NOW());
    `);
    // Insert Role
    await queryRunner.query(`
      INSERT INTO roles (id, name, description)
      VALUES ('${roleId}', 'Admin', 'Administrator with full access');
    `);
    // Insert Permission
    await queryRunner.query(`
      INSERT INTO permissions (id, name, description)
      VALUES ('${permissionId}', 'manage_users', 'Can manage user accounts');
    `);
    // Insert RolePermission
    await queryRunner.query(`
      INSERT INTO role_permissions (id, role_id, permission_id)
      VALUES ('${rolePermissionId}', '${roleId}', '${permissionId}');
    `);
    // Insert User
    await queryRunner.query(`
      INSERT INTO users (
        id, email, phone, password, first_name, last_name,
        role_id, tenant_id, created_at, updated_at
      ) VALUES (
        '${userId}', 'admin@acme.com', '1234567890', 'hashed_password',
        'John', 'Doe', '${roleId}', '${tenantId}', NOW(), NOW()
      );
    `);
    // Insert Department
    await queryRunner.query(`
      INSERT INTO departments (id, name, description, tenant_id, created_at)
      VALUES ('${departmentId}', 'Engineering', 'Handles software and systems', '${tenantId}', NOW());
    `);
    // Insert Designation
    await queryRunner.query(`
      INSERT INTO designations (id, title, department_id, created_at)
      VALUES ('${designationId}', 'Software Engineer', '${departmentId}', NOW());
    `);
    // Insert Employee
    await queryRunner.query(`
      INSERT INTO employees (id, user_id, designation_id, created_at)
      VALUES ('${employeeId}', '${userId}', '${designationId}', NOW());
    `);
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM employees WHERE id IS NOT NULL;`);
    await queryRunner.query(`DELETE FROM designations WHERE id IS NOT NULL;`);
    await queryRunner.query(`DELETE FROM departments WHERE id IS NOT NULL;`);
    await queryRunner.query(`DELETE FROM users WHERE id IS NOT NULL;`);
    await queryRunner.query(`DELETE FROM role_permissions WHERE id IS NOT NULL;`);
    await queryRunner.query(`DELETE FROM permissions WHERE id IS NOT NULL;`);
    await queryRunner.query(`DELETE FROM roles WHERE id IS NOT NULL;`);
    await queryRunner.query(`DELETE FROM tenants WHERE id IS NOT NULL;`);
  }
}
