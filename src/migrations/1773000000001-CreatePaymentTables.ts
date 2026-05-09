import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates three new tables in the public (shared) schema:
 *   payment_subscriptions – PayPal subscription lifecycle records
 *   payment_transactions  – Immutable audit log of every payment event (idempotency key on webhook_event_id)
 *   addon_purchases       – Employee-slot one-time purchases
 *
 * Billing data lives in the public schema so webhook processors can resolve
 * tenants without switching to per-tenant schemas.
 */
export class CreatePaymentTables1773000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── payment_subscriptions ─────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "payment_subscriptions" (
        "id"                     uuid         NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id"              uuid         NOT NULL,
        "paypal_subscription_id" varchar(100),
        "paypal_plan_id"         varchar(100),
        "status"                 varchar(20)  NOT NULL DEFAULT 'APPROVAL_PENDING',
        "amount"                 decimal(10,2),
        "currency"               varchar(3)   NOT NULL DEFAULT 'USD',
        "payment_provider"       varchar(20)  NOT NULL DEFAULT 'paypal',
        "started_at"             timestamptz,
        "expires_at"             timestamptz,
        "next_billing_at"        timestamptz,
        "cancelled_at"           timestamptz,
        "metadata"               jsonb,
        "created_at"             timestamptz  NOT NULL DEFAULT now(),
        "updated_at"             timestamptz  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payment_subscriptions" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_ps_tenant_id" ON "payment_subscriptions" ("tenant_id")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "uidx_ps_paypal_subscription_id" ON "payment_subscriptions" ("paypal_subscription_id") WHERE "paypal_subscription_id" IS NOT NULL`);
    await queryRunner.query(`CREATE INDEX "idx_ps_status" ON "payment_subscriptions" ("status")`);

    // ── payment_transactions ──────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "payment_transactions" (
        "id"                  uuid         NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id"           uuid         NOT NULL,
        "subscription_id"     uuid,
        "paypal_order_id"     varchar(100),
        "paypal_capture_id"   varchar(100),
        "amount"              decimal(10,2) NOT NULL DEFAULT 0,
        "currency"            varchar(3)   NOT NULL DEFAULT 'USD',
        "status"              varchar(20)  NOT NULL DEFAULT 'PENDING',
        "payment_type"        varchar(30)  NOT NULL,
        "webhook_event_id"    varchar(100),
        "webhook_event_type"  varchar(100),
        "raw_response"        jsonb,
        "created_at"          timestamptz  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payment_transactions" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_pt_tenant_id" ON "payment_transactions" ("tenant_id")`);
    await queryRunner.query(`CREATE INDEX "idx_pt_subscription_id" ON "payment_transactions" ("subscription_id")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "uidx_pt_webhook_event_id" ON "payment_transactions" ("webhook_event_id") WHERE "webhook_event_id" IS NOT NULL`);

    // ── addon_purchases ───────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "addon_purchases" (
        "id"               uuid          NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id"        uuid          NOT NULL,
        "employee_count"   int           NOT NULL DEFAULT 0,
        "amount"           decimal(10,2) NOT NULL,
        "payment_status"   varchar(20)   NOT NULL DEFAULT 'PENDING',
        "paypal_order_id"  varchar(100),
        "paypal_capture_id" varchar(100),
        "metadata"         jsonb,
        "created_at"       timestamptz   NOT NULL DEFAULT now(),
        "updated_at"       timestamptz   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_addon_purchases" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_ap_tenant_id" ON "addon_purchases" ("tenant_id")`);
    await queryRunner.query(`CREATE INDEX "idx_ap_payment_status" ON "addon_purchases" ("payment_status")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "uidx_ap_paypal_order_id" ON "addon_purchases" ("paypal_order_id") WHERE "paypal_order_id" IS NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "addon_purchases"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_transactions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_subscriptions"`);
  }
}
