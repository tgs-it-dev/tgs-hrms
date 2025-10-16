import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLogoToCompanyDetails1759000000000 implements MigrationInterface {
    name = 'AddLogoToCompanyDetails1759000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "company_details" ADD "logo_url" varchar`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "company_details" DROP COLUMN "logo_url"`);
    }
}
