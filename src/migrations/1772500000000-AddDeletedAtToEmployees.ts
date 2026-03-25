import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeletedAtToEmployees1772500000000 implements MigrationInterface {
  name = 'AddDeletedAtToEmployees1772500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "employees"
      ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP WITH TIME ZONE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "employees" DROP COLUMN IF EXISTS "deleted_at"
    `);
  }
}
