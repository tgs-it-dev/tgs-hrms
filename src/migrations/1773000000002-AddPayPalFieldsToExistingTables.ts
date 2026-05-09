import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Additive migration — adds PayPal-specific columns to existing tables.
 * All existing Stripe columns are preserved for backward compatibility with
 * historical records already in the database.
 */
export class AddPayPalFieldsToExistingTables1773000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── subscription_plans: add PayPal fields ─────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "subscription_plans"
        ADD COLUMN IF NOT EXISTS "paypal_plan_id"         varchar(100),
        ADD COLUMN IF NOT EXISTS "billing_cycle"          varchar(20),
        ADD COLUMN IF NOT EXISTS "amount"                 decimal(10,2),
        ADD COLUMN IF NOT EXISTS "active"                 boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "allows_addons"          boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "addon_feature_enabled"  boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "max_employees"          int
    `);

    // Relax NOT NULL on stripePriceId — Stripe is no longer the only provider
    await queryRunner.query(`
      ALTER TABLE "subscription_plans"
        ALTER COLUMN "stripePriceId" DROP NOT NULL
    `);

    // ── company_details: add PayPal fields ────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "company_details"
        ADD COLUMN IF NOT EXISTS "paypal_subscription_id" varchar(100),
        ADD COLUMN IF NOT EXISTS "paypal_order_id"        varchar(100),
        ADD COLUMN IF NOT EXISTS "payment_provider"       varchar(20)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_cd_paypal_subscription_id"
        ON "company_details" ("paypal_subscription_id")
        WHERE "paypal_subscription_id" IS NOT NULL
    `);

    // ── billing_transactions: add PayPal fields ───────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "billing_transactions"
        ADD COLUMN IF NOT EXISTS "paypal_order_id"   varchar(100),
        ADD COLUMN IF NOT EXISTS "paypal_capture_id" varchar(100)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_cd_paypal_subscription_id"`);

    await queryRunner.query(`
      ALTER TABLE "billing_transactions"
        DROP COLUMN IF EXISTS "paypal_order_id",
        DROP COLUMN IF EXISTS "paypal_capture_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "company_details"
        DROP COLUMN IF EXISTS "paypal_subscription_id",
        DROP COLUMN IF EXISTS "paypal_order_id",
        DROP COLUMN IF EXISTS "payment_provider"
    `);

    await queryRunner.query(`
      ALTER TABLE "subscription_plans"
        DROP COLUMN IF EXISTS "paypal_plan_id",
        DROP COLUMN IF EXISTS "billing_cycle",
        DROP COLUMN IF EXISTS "amount",
        DROP COLUMN IF EXISTS "active",
        DROP COLUMN IF EXISTS "allows_addons",
        DROP COLUMN IF EXISTS "addon_feature_enabled",
        DROP COLUMN IF EXISTS "max_employees"
    `);
  }
}
