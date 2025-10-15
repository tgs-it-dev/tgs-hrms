import { MigrationInterface, QueryRunner } from "typeorm";

export class SeedGlobalDepartmentsDesignations1759000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const GLOBAL_TENANT_ID = `'00000000-0000-0000-0000-000000000000'`;

    // ✅ Insert default tenant
    await queryRunner.query(`
      INSERT INTO "tenants" ("id", "name", "created_at")
      VALUES ('00000000-0000-0000-0000-000000000000', 'Default Tenant', now())
      ON CONFLICT ("id") DO NOTHING
    `);

    // Insert GLOBAL departments if not exists
    await queryRunner.query(`
      INSERT INTO departments (name, description, tenant_id)
      SELECT 'HR', 'Handles employee relations, recruitment, onboarding, payroll, and overall people management.', ${GLOBAL_TENANT_ID}
      WHERE NOT EXISTS (SELECT 1 FROM departments WHERE name = 'HR' AND tenant_id = ${GLOBAL_TENANT_ID});
    `);

    await queryRunner.query(`
      INSERT INTO departments (name, description, tenant_id)
      SELECT 'Engineering', 'Responsible for building, testing, and maintaining software solutions including web, mobile, and backend systems.', ${GLOBAL_TENANT_ID}
      WHERE NOT EXISTS (SELECT 1 FROM departments WHERE name = 'Engineering' AND tenant_id = ${GLOBAL_TENANT_ID});
    `);

    await queryRunner.query(`
      INSERT INTO departments (name, description, tenant_id)
      SELECT 'Finance', 'Manages company finances including accounting, audits, financial planning, and expense control.', ${GLOBAL_TENANT_ID}
      WHERE NOT EXISTS (SELECT 1 FROM departments WHERE name = 'Finance' AND tenant_id = ${GLOBAL_TENANT_ID});
    `);

    // HR designations
    await queryRunner.query(`
      WITH dept AS (SELECT id FROM departments WHERE name = 'HR' AND tenant_id = ${GLOBAL_TENANT_ID})
      INSERT INTO designations (title, department_id)
      SELECT 'HR Manager', dept.id FROM dept
      WHERE NOT EXISTS (
        SELECT 1 FROM designations d WHERE d.title = 'HR Manager' AND d.department_id = dept.id
      );
    `);

    await queryRunner.query(`
      WITH dept AS (SELECT id FROM departments WHERE name = 'HR' AND tenant_id = ${GLOBAL_TENANT_ID})
      INSERT INTO designations (title, department_id)
      SELECT 'HR Executive', dept.id FROM dept
      WHERE NOT EXISTS (
        SELECT 1 FROM designations d WHERE d.title = 'HR Executive' AND d.department_id = dept.id
      );
    `);

    // Engineering designations
    await queryRunner.query(`
      WITH dept AS (SELECT id FROM departments WHERE name = 'Engineering' AND tenant_id = ${GLOBAL_TENANT_ID})
      INSERT INTO designations (title, department_id)
      SELECT 'Software Engineer', dept.id FROM dept
      WHERE NOT EXISTS (
        SELECT 1 FROM designations d WHERE d.title = 'Software Engineer' AND d.department_id = dept.id
      );
    `);

    await queryRunner.query(`
      WITH dept AS (SELECT id FROM departments WHERE name = 'Engineering' AND tenant_id = ${GLOBAL_TENANT_ID})
      INSERT INTO designations (title, department_id)
      SELECT 'Senior Software Engineer', dept.id FROM dept
      WHERE NOT EXISTS (
        SELECT 1 FROM designations d WHERE d.title = 'Senior Software Engineer' AND d.department_id = dept.id
      );
    `);

    // Finance designations
    await queryRunner.query(`
      WITH dept AS (SELECT id FROM departments WHERE name = 'Finance' AND tenant_id = ${GLOBAL_TENANT_ID})
      INSERT INTO designations (title, department_id)
      SELECT 'Accountant', dept.id FROM dept
      WHERE NOT EXISTS (
        SELECT 1 FROM designations d WHERE d.title = 'Accountant' AND d.department_id = dept.id
      );
    `);

    await queryRunner.query(`
      WITH dept AS (SELECT id FROM departments WHERE name = 'Finance' AND tenant_id = ${GLOBAL_TENANT_ID})
      INSERT INTO designations (title, department_id)
      SELECT 'Finance Manager', dept.id FROM dept
      WHERE NOT EXISTS (
        SELECT 1 FROM designations d WHERE d.title = 'Finance Manager' AND d.department_id = dept.id
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const GLOBAL_TENANT_ID = `'00000000-0000-0000-0000-000000000000'`;

    // Remove seeded designations that belong to GLOBAL departments
    await queryRunner.query(`
      DELETE FROM designations d USING departments dept
      WHERE d.department_id = dept.id
        AND dept.tenant_id = ${GLOBAL_TENANT_ID}
        AND d.title IN (
          'HR Manager', 'HR Executive',
          'Software Engineer', 'Senior Software Engineer',
          'Accountant', 'Finance Manager'
        );
    `);

    // Remove seeded GLOBAL departments
    await queryRunner.query(`
      DELETE FROM departments
      WHERE tenant_id = ${GLOBAL_TENANT_ID} AND name IN ('HR', 'Engineering', 'Finance');
    `);
  }
}
