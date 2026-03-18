import { MigrationInterface, QueryRunner } from 'typeorm';

export class UniqueDomainCompanyDetails1772200000000 implements MigrationInterface {
  name = 'UniqueDomainCompanyDetails1772200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_company_details_domain" ON "company_details" (LOWER("domain"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_company_details_domain"`);
  }
}
