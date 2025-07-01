import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixDepartmentSchema1751399282628 implements MigrationInterface {
  name = 'FixDepartmentSchema1751399282628';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add tenantId column as nullable
    await queryRunner.query(`
      ALTER TABLE "department" ADD "tenantId" uuid
    `);

    // 2. Backfill tenantId from tenant (if tenant FK column is named "tenant")
    await queryRunner.query(`
      UPDATE "department" SET "tenantId" = "tenant"
    `);

    // 3. Make tenantId NOT NULL
    await queryRunner.query(`
      ALTER TABLE "department" ALTER COLUMN "tenantId" SET NOT NULL
    `);

    // 4. Create unique index
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_e58e500747caf6053616faaf37"
      ON "department" ("tenantId", "name")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX "IDX_e58e500747caf6053616faaf37"
    `);
    await queryRunner.query(`
      ALTER TABLE "department" DROP COLUMN "tenantId"
    `);
  }
}
