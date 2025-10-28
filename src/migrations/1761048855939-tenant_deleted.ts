import { MigrationInterface, QueryRunner } from "typeorm";

export class TenantDeleted1761048855939 implements MigrationInterface {
  name = "TenantDeleted1761048855939";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD "isDeleted" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "tenants" ADD "deleted_at" TIMESTAMP`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN "deleted_at"`);
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN "updated_at"`);
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN "isDeleted"`);
  }
}
