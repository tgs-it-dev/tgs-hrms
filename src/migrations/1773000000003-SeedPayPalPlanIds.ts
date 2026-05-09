import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seeds PayPal plan IDs into existing subscription_plans rows.
 *
 * Plan IDs are read from environment variables so they work in both sandbox
 * and production without code changes.  If a variable is not set the column
 * is left NULL and the plan will fail at payment time with a clear error.
 *
 * Run `PAYPAL_BASIC_PLAN_ID`, `PAYPAL_PRO_PLAN_ID`, and
 * `PAYPAL_ENTERPRISE_PLAN_ID` in your environment before applying migrations.
 */
export class SeedPayPalPlanIds1773000000003 implements MigrationInterface {
  private readonly planMappings = [
    { name: 'Basic Plan', envVar: 'PAYPAL_BASIC_PLAN_ID', billing_cycle: 'MONTHLY', allows_addons: false, addon_feature_enabled: false, max_employees: 10 },
    { name: 'Pro Plan', envVar: 'PAYPAL_PRO_PLAN_ID', billing_cycle: 'MONTHLY', allows_addons: true, addon_feature_enabled: true, max_employees: 50 },
    { name: 'Enterprise Plan', envVar: 'PAYPAL_ENTERPRISE_PLAN_ID', billing_cycle: 'MONTHLY', allows_addons: true, addon_feature_enabled: true, max_employees: null },
  ] as const;

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('subscription_plans');
    if (!hasTable) return;

    for (const mapping of this.planMappings) {
      const paypalPlanId = process.env[mapping.envVar];

      await queryRunner.query(
        `
        UPDATE "subscription_plans"
        SET
          "paypal_plan_id"         = $1,
          "billing_cycle"          = $2,
          "allows_addons"          = $3,
          "addon_feature_enabled"  = $4,
          "max_employees"          = $5,
          "active"                 = true
        WHERE LOWER("name") = LOWER($6)
        `,
        [
          paypalPlanId ?? null,
          mapping.billing_cycle,
          mapping.allows_addons,
          mapping.addon_feature_enabled,
          mapping.max_employees ?? null,
          mapping.name,
        ],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('subscription_plans'))) return;

    await queryRunner.query(`
      UPDATE "subscription_plans"
      SET
        "paypal_plan_id"         = NULL,
        "billing_cycle"          = NULL,
        "allows_addons"          = false,
        "addon_feature_enabled"  = false,
        "max_employees"          = NULL
    `);
  }
}
