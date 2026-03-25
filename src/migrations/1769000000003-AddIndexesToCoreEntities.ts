import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIndexesToCoreEntities1769000000003 implements MigrationInterface {
  name = "AddIndexesToCoreEntities1769000000003";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Users table indexes
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_users_tenant_id" ON "users" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_users_email" ON "users" ("email")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_users_tenant_id_email" ON "users" ("tenant_id", "email")`,
    );

    // Employees table indexes
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_employees_user_id" ON "employees" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_employees_designation_id" ON "employees" ("designation_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_employees_team_id" ON "employees" ("team_id")`,
    );

    // Departments table indexes
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_departments_tenant_id" ON "departments" ("tenant_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop departments indexes
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_departments_tenant_id"`,
    );

    // Drop employees indexes
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_employees_team_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_employees_designation_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_employees_user_id"`,
    );

    // Drop users indexes
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_users_tenant_id_email"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_users_email"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_users_tenant_id"`,
    );
  }
}


