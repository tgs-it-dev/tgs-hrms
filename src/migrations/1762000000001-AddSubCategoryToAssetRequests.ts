import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubCategoryToAssetRequests1762000000001 implements MigrationInterface {
  name = 'AddSubCategoryToAssetRequests1762000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "asset_requests" 
      ADD COLUMN "asset_sub_category" VARCHAR NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "asset_requests" 
      DROP COLUMN "asset_sub_category"
    `);
  }
}
