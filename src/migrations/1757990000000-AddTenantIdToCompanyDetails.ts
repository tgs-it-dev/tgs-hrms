import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTenantIdToCompanyDetails1757990000000 implements MigrationInterface {
    name = 'AddTenantIdToCompanyDetails1757990000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "company_details" ADD "tenant_id" uuid`);
        await queryRunner.query(`ALTER TABLE "company_details" ADD CONSTRAINT "FK_company_details_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "company_details" DROP CONSTRAINT "FK_company_details_tenant"`);
        await queryRunner.query(`ALTER TABLE "company_details" DROP COLUMN "tenant_id"`);
    }
}


