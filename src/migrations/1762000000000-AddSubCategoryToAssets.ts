import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubCategoryToAssets1762000000000 implements MigrationInterface {
  name = 'AddSubCategoryToAssets1762000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "assets" 
      ADD COLUMN "sub_category" VARCHAR NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "assets" 
      DROP COLUMN "sub_category"
    `);
  }
}
