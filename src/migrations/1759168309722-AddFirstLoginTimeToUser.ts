import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFirstLoginTimeToUser1759168309722
  implements MigrationInterface
{
  name = "AddFirstLoginTimeToUser1759168309722";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "company_details" DROP CONSTRAINT "FK_company_details_tenant"`,
    );
    await queryRunner.query(
      `ALTER TABLE "policies" DROP CONSTRAINT "FK_policies_tenant"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_policies_unique_tenant_title_category"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "first_login_time" TIMESTAMP WITH TIME ZONE`,
    );
    // Update null tenant_id values before setting NOT NULL constraint
    await queryRunner.query(
      `UPDATE "company_details" SET "tenant_id" = (SELECT "id" FROM "tenants" LIMIT 1) WHERE "tenant_id" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "company_details" ALTER COLUMN "tenant_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_a4ca198944091ef1dbcc36c191" ON "policies" ("tenant_id", "title", "category") `,
    );
    await queryRunner.query(
      `ALTER TABLE "company_details" ADD CONSTRAINT "FK_5405814a5c819e395b0f7c496a2" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "policies" ADD CONSTRAINT "FK_7c1e91061ee12ae5918c9cae320" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "policies" DROP CONSTRAINT "FK_7c1e91061ee12ae5918c9cae320"`,
    );
    await queryRunner.query(
      `ALTER TABLE "company_details" DROP CONSTRAINT "FK_5405814a5c819e395b0f7c496a2"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a4ca198944091ef1dbcc36c191"`,
    );
    await queryRunner.query(
      `ALTER TABLE "company_details" ALTER COLUMN "tenant_id" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "first_login_time"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_policies_unique_tenant_title_category" ON "policies" ("category", "tenant_id", "title") `,
    );
    await queryRunner.query(
      `ALTER TABLE "policies" ADD CONSTRAINT "FK_policies_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "company_details" ADD CONSTRAINT "FK_company_details_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
