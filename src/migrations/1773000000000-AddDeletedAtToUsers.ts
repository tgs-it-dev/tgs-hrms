import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeletedAtToUsers1773000000000 implements MigrationInterface {
  name = 'AddDeletedAtToUsers1773000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP WITH TIME ZONE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "deleted_at"
    `);
  }
}
