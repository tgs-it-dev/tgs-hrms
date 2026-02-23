import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Makes user email globally unique across the entire database (all tenants).
 * - Drops composite (email, tenant_id) indexes if present.
 * - Adds a UNIQUE constraint on users.email.
 *
 * Note: If you have existing rows with the same email in different tenants,
 * the ADD CONSTRAINT step will fail. Resolve duplicates before running.
 */
export class MakeUserEmailGloballyUnique1772100000000
  implements MigrationInterface
{
  name = 'MakeUserEmailGloballyUnique1772100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.startTransaction();

    try {
      await queryRunner.query(`
        DROP INDEX IF EXISTS idx_users_email_tenant;
      `);

      await queryRunner.query(`
        DROP INDEX IF EXISTS "IDX_users_email_tenant_id";
      `);

      await queryRunner.query(`
        ALTER TABLE "users" ADD CONSTRAINT "UQ_users_email" UNIQUE ("email");
      `);

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.startTransaction();

    try {
      await queryRunner.query(`
        ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "UQ_users_email";
      `);

      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_users_email_tenant ON users (email, tenant_id);
      `);

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    }
  }
}
