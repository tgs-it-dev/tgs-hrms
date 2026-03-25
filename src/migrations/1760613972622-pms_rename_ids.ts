import { MigrationInterface, QueryRunner } from "typeorm";

export class PmsRenameIds1760613972622 implements MigrationInterface {
  name = "PmsRenameIds1760613972622";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "performance_reviews" DROP COLUMN "tenantId"`,
    );
    await queryRunner.query(`ALTER TABLE "promotions" DROP COLUMN "tenantId"`);
    await queryRunner.query(
      `ALTER TABLE "promotions" DROP COLUMN "employeeId"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "promotions" ADD "employeeId" character varying NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "promotions" ADD "tenantId" character varying NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "performance_reviews" ADD "tenantId" character varying NOT NULL`,
    );
  }
}
