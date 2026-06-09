import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaypalPlanIdToSubscriptionPlans1782000000001
  implements MigrationInterface
{
  name = 'AddPaypalPlanIdToSubscriptionPlans1782000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subscription_plans"
        ADD COLUMN IF NOT EXISTS "paypalPlanId" character varying(100) NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subscription_plans"
        DROP COLUMN IF EXISTS "paypalPlanId"`,
    );
  }
}
