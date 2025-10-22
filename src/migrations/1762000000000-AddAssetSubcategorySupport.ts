import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAssetSubcategorySupport1762000000000 implements MigrationInterface {
  name = 'AddAssetSubcategorySupport1762000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create asset_subcategories table
    await queryRunner.query(`
      CREATE TABLE "asset_subcategories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar NOT NULL,
        "category" varchar NOT NULL,
        "description" text,
        "tenant_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_asset_subcategories_id" PRIMARY KEY ("id")
      )
    `);

    // Create index for tenant_id
    await queryRunner.query(`
      CREATE INDEX "IDX_asset_subcategories_tenant" ON "asset_subcategories" ("tenant_id")
    `);

    // Create unique constraint for name + category + tenant_id
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_asset_subcategories_unique" ON "asset_subcategories" ("name", "category", "tenant_id")
    `);

    // Add foreign key to tenants
    await queryRunner.query(`
      ALTER TABLE "asset_subcategories"
      ADD CONSTRAINT "FK_asset_subcategories_tenant"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    // Add subcategory_id column to assets table
    await queryRunner.query(`
      ALTER TABLE "assets" 
      ADD COLUMN "subcategory_id" uuid
    `);

    // Add foreign key for assets subcategory
    await queryRunner.query(`
      ALTER TABLE "assets"
      ADD CONSTRAINT "FK_assets_subcategory"
      FOREIGN KEY ("subcategory_id") REFERENCES "asset_subcategories"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    // Add subcategory_id column to asset_requests table
    await queryRunner.query(`
      ALTER TABLE "asset_requests" 
      ADD COLUMN "subcategory_id" uuid
    `);

    // Add foreign key for asset_requests subcategory
    await queryRunner.query(`
      ALTER TABLE "asset_requests"
      ADD CONSTRAINT "FK_asset_requests_subcategory"
      FOREIGN KEY ("subcategory_id") REFERENCES "asset_subcategories"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    // Create indexes for better performance
    await queryRunner.query(`
      CREATE INDEX "IDX_assets_subcategory" ON "assets" ("subcategory_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_asset_requests_subcategory" ON "asset_requests" ("subcategory_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_asset_requests_subcategory"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_assets_subcategory"`);
    
    // Drop foreign keys
    await queryRunner.query(`ALTER TABLE "asset_requests" DROP CONSTRAINT "FK_asset_requests_subcategory"`);
    await queryRunner.query(`ALTER TABLE "assets" DROP CONSTRAINT "FK_assets_subcategory"`);
    
    // Drop columns
    await queryRunner.query(`ALTER TABLE "asset_requests" DROP COLUMN "subcategory_id"`);
    await queryRunner.query(`ALTER TABLE "assets" DROP COLUMN "subcategory_id"`);
    
    // Drop asset_subcategories table
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_asset_subcategories_unique"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_asset_subcategories_tenant"`);
    await queryRunner.query(`DROP TABLE "asset_subcategories"`);
  }
}
