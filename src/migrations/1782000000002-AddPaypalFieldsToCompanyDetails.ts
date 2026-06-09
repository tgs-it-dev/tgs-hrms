import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaypalFieldsToCompanyDetails1782000000002
  implements MigrationInterface
{
  name = 'AddPaypalFieldsToCompanyDetails1782000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "company_details"
        ADD COLUMN IF NOT EXISTS "paypal_subscription_id" character varying(100) NULL,
        ADD COLUMN IF NOT EXISTS "paypal_payer_id"        character varying(100) NULL,
        ADD COLUMN IF NOT EXISTS "active_plan_id"         uuid NULL REFERENCES "subscription_plans"("id") ON DELETE SET NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "company_details"
        DROP COLUMN IF EXISTS "paypal_subscription_id",
        DROP COLUMN IF EXISTS "paypal_payer_id",
        DROP COLUMN IF EXISTS "active_plan_id"`,
    );
  }
}
