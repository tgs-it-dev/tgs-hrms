import { MigrationInterface, QueryRunner } from 'typeorm';

export class MoveAssetCommentsToAssetRequests1770000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Add new column asset_request_id to asset_comments table
    await queryRunner.query(`
      ALTER TABLE asset_comments 
      ADD COLUMN asset_request_id UUID;
    `);

    // Step 2: Populate asset_request_id from asset_id
    // Find asset requests that have the asset_id matching comments' asset_id
    await queryRunner.query(`
      UPDATE asset_comments ac
      SET asset_request_id = ar.id
      FROM asset_requests ar
      WHERE ar.asset_id = ac.asset_id
        AND ar.tenant_id = ac.tenant_id;
    `);

    // Step 3: Drop old foreign key constraint on asset_id
    await queryRunner.query(`
      ALTER TABLE asset_comments 
      DROP CONSTRAINT IF EXISTS FK_asset_comments_asset_id;
    `);

    // Step 4: Drop old index on asset_id
    await queryRunner.query(`
      DROP INDEX IF EXISTS IDX_asset_comments_asset_id;
    `);

    // Step 5: Drop asset_id column
    await queryRunner.query(`
      ALTER TABLE asset_comments 
      DROP COLUMN IF EXISTS asset_id;
    `);

    // Step 6: Make asset_request_id NOT NULL (after data migration)
    await queryRunner.query(`
      ALTER TABLE asset_comments 
      ALTER COLUMN asset_request_id SET NOT NULL;
    `);

    // Step 7: Create new index on asset_request_id
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_asset_comments_asset_request_id 
      ON asset_comments(asset_request_id);
    `);

    // Step 8: Add foreign key constraint on asset_request_id
    await queryRunner.query(`
      ALTER TABLE asset_comments 
      ADD CONSTRAINT FK_asset_comments_asset_request_id 
      FOREIGN KEY (asset_request_id) 
      REFERENCES asset_requests(id) 
      ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Drop foreign key constraint on asset_request_id
    await queryRunner.query(`
      ALTER TABLE asset_comments 
      DROP CONSTRAINT IF EXISTS FK_asset_comments_asset_request_id;
    `);

    // Step 2: Drop index on asset_request_id
    await queryRunner.query(`
      DROP INDEX IF EXISTS IDX_asset_comments_asset_request_id;
    `);

    // Step 3: Add asset_id column back
    await queryRunner.query(`
      ALTER TABLE asset_comments 
      ADD COLUMN asset_id UUID;
    `);

    // Step 4: Populate asset_id from asset_request_id
    await queryRunner.query(`
      UPDATE asset_comments ac
      SET asset_id = ar.asset_id
      FROM asset_requests ar
      WHERE ar.id = ac.asset_request_id
        AND ar.tenant_id = ac.tenant_id;
    `);

    // Step 5: Make asset_id NOT NULL
    await queryRunner.query(`
      ALTER TABLE asset_comments 
      ALTER COLUMN asset_id SET NOT NULL;
    `);

    // Step 6: Create index on asset_id
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_asset_comments_asset_id 
      ON asset_comments(asset_id);
    `);

    // Step 7: Add foreign key constraint on asset_id
    await queryRunner.query(`
      ALTER TABLE asset_comments 
      ADD CONSTRAINT FK_asset_comments_asset_id 
      FOREIGN KEY (asset_id) 
      REFERENCES assets(id) 
      ON DELETE CASCADE;
    `);

    // Step 8: Drop asset_request_id column
    await queryRunner.query(`
      ALTER TABLE asset_comments 
      DROP COLUMN IF EXISTS asset_request_id;
    `);
  }
}
