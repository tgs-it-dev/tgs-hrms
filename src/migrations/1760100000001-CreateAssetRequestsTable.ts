import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAssetRequestsTable1760100000001 implements MigrationInterface {
  name = 'CreateAssetRequestsTable1760100000001'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "asset_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "asset_category" varchar NOT NULL,
        "requested_by" uuid NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "approved_by" uuid,
        "requested_date" date NOT NULL,
        "approved_date" date,
        "tenant_id" uuid NOT NULL,
        "remarks" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_asset_requests_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_asset_requests_tenant" ON "asset_requests" ("tenant_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "asset_requests"
      ADD CONSTRAINT "FK_asset_requests_requested_by_user"
      FOREIGN KEY ("requested_by") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "asset_requests"
      ADD CONSTRAINT "FK_asset_requests_approved_by_user"
      FOREIGN KEY ("approved_by") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "asset_requests"
      ADD CONSTRAINT "FK_asset_requests_tenant"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "asset_requests" DROP CONSTRAINT "FK_asset_requests_tenant"`);
    await queryRunner.query(`ALTER TABLE "asset_requests" DROP CONSTRAINT "FK_asset_requests_approved_by_user"`);
    await queryRunner.query(`ALTER TABLE "asset_requests" DROP CONSTRAINT "FK_asset_requests_requested_by_user"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_asset_requests_tenant"`);
    await queryRunner.query(`DROP TABLE "asset_requests"`);
  }
}


