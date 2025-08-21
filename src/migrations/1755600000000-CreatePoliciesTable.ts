import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePoliciesTable1755600000000 implements MigrationInterface {
    name = 'CreatePoliciesTable1755600000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "policies" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
            "tenant_id" uuid NOT NULL,
            "title" varchar(150) NOT NULL,
            "category" varchar(50) NOT NULL,
            "body" text NOT NULL,
            "effective_from" date,
            "is_active" boolean NOT NULL DEFAULT true,
            "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            "deleted_at" TIMESTAMP WITH TIME ZONE,
            CONSTRAINT "PK_policies_id" PRIMARY KEY ("id")
        )`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_policies_unique_tenant_title_category" ON "policies" ("tenant_id", "title", "category")`);
        await queryRunner.query(`ALTER TABLE "policies" ADD CONSTRAINT "FK_policies_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "policies" DROP CONSTRAINT "FK_policies_tenant"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_policies_unique_tenant_title_category"`);
        await queryRunner.query(`DROP TABLE "policies"`);
    }
}


