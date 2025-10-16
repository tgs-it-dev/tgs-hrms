import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAssetsTable1760100000000 implements MigrationInterface {
  name = 'CreateAssetsTable1760100000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "assets" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar NOT NULL,
        "category" varchar NOT NULL,
        "status" varchar(30) NOT NULL DEFAULT 'available',
        "assigned_to" uuid,
        "purchase_date" date,
        "tenant_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_assets_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_assets_tenant" ON "assets" ("tenant_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "assets"
      ADD CONSTRAINT "FK_assets_assigned_to_user"
      FOREIGN KEY ("assigned_to") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "assets"
      ADD CONSTRAINT "FK_assets_tenant"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "assets" DROP CONSTRAINT "FK_assets_tenant"`);
    await queryRunner.query(`ALTER TABLE "assets" DROP CONSTRAINT "FK_assets_assigned_to_user"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_assets_tenant"`);
    await queryRunner.query(`DROP TABLE "assets"`);
  }
}


