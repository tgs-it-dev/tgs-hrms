import { MigrationInterface, QueryRunner } from "typeorm";

export class PmsRelationIds1760607326761 implements MigrationInterface {
  name = "PmsRelationIds1760607326761";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "kpis" DROP COLUMN "tenantId"`);
    await queryRunner.query(
      `ALTER TABLE "employee-kpis" DROP COLUMN "employeeId"`,
    );
    await queryRunner.query(`ALTER TABLE "employee-kpis" DROP COLUMN "kpiId"`);
    await queryRunner.query(
      `ALTER TABLE "employee-kpis" DROP COLUMN "tenantId"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "employee-kpis" ADD "tenantId" character varying NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "employee-kpis" ADD "kpiId" character varying NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "employee-kpis" ADD "employeeId" character varying NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "kpis" ADD "tenantId" character varying NOT NULL`,
    );
  }
}
