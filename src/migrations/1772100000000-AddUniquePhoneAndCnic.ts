import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Enforces unique phone (users) and CNIC (employees) across the database.
 * - users.phone: globally unique
 * - employees.cnic_number: unique for non-null values (multiple NULLs allowed)
 */
export class AddUniquePhoneAndCnic1772100000000 implements MigrationInterface {
  name = 'AddUniquePhoneAndCnic1772100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Unique constraint on users.phone (globally)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_phone_unique"
      ON "users" ("phone")
    `);

    // Unique constraint on employees.cnic_number (allows multiple NULLs; non-null values must be unique)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_employees_cnic_number_unique"
      ON "employees" ("cnic_number")
      WHERE "cnic_number" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_phone_unique"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_employees_cnic_number_unique"`);
  }
}
