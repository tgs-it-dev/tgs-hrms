import { MigrationInterface, QueryRunner } from "typeorm";

export class MakeTenantIdNullableInCompanyDetails1759999999999 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "company_details" ALTER COLUMN "tenant_id" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "company_details" ALTER COLUMN "tenant_id" SET NOT NULL`);
    }
}
