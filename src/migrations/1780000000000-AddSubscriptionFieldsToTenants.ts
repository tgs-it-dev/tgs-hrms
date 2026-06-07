import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubscriptionFieldsToTenants1780000000000
  implements MigrationInterface
{
  name = 'AddSubscriptionFieldsToTenants1780000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tenants"
        ADD COLUMN IF NOT EXISTS "subscription_status" character varying NOT NULL DEFAULT 'trial',
        ADD COLUMN IF NOT EXISTS "trial_ends_at"        TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS "grace_period_ends_at" TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS "seat_limit"           integer`,
    );

    // Backfill: existing tenants that are active get ACTIVE status with no trial window.
    await queryRunner.query(
      `UPDATE "tenants"
          SET "subscription_status" = 'active'
        WHERE "status" = 'active'
          AND "subscription_status" = 'trial'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tenants"
        DROP COLUMN IF EXISTS "subscription_status",
        DROP COLUMN IF EXISTS "trial_ends_at",
        DROP COLUMN IF EXISTS "grace_period_ends_at",
        DROP COLUMN IF EXISTS "seat_limit"`,
    );
  }
}
