import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateHolidaysTable1755600000001 implements MigrationInterface {
    name = 'CreateHolidaysTable1755600000001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "holidays" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
            "tenant_id" uuid NOT NULL,
            "name" varchar(100) NOT NULL,
            "date" date NOT NULL,
            "description" text,
            "is_active" boolean NOT NULL DEFAULT true,
            "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            CONSTRAINT "PK_holidays_id" PRIMARY KEY ("id")
        )`);
        
        // Create unique constraint to prevent duplicate holidays on the same date for a tenant
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_holidays_unique_tenant_date" ON "holidays" ("tenant_id", "date")`);
        
        // Create index for better query performance
        await queryRunner.query(`CREATE INDEX "IDX_holidays_tenant_active" ON "holidays" ("tenant_id", "is_active")`);
        await queryRunner.query(`CREATE INDEX "IDX_holidays_date" ON "holidays" ("date")`);
        
        // Add foreign key constraint
        await queryRunner.query(`ALTER TABLE "holidays" ADD CONSTRAINT "FK_holidays_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "holidays" DROP CONSTRAINT "FK_holidays_tenant"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_holidays_date"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_holidays_tenant_active"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_holidays_unique_tenant_date"`);
        await queryRunner.query(`DROP TABLE "holidays"`);
    }
}
