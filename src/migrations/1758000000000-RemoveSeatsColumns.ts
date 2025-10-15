import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveSeatsColumns1758000000000 implements MigrationInterface {
  name = "RemoveSeatsColumns1758000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "company_details" DROP COLUMN IF EXISTS "seats"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscription_plans" DROP COLUMN IF EXISTS "seats"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subscription_plans" ADD COLUMN "seats" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "company_details" ADD COLUMN "seats" integer NOT NULL DEFAULT 1`,
    );
    await queryRunner.query(
      `ALTER TABLE "company_details" ALTER COLUMN "seats" DROP DEFAULT`,
    );
  }
}
