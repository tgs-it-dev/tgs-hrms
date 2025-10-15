import { MigrationInterface, QueryRunner } from "typeorm";

export class SeedDefaultPlans1757989700000 implements MigrationInterface {
  name = "SeedDefaultPlans1757989700000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.manager
      .createQueryBuilder()
      .insert()
      .into("subscription_plans")
      .values([
        {
          name: "Basic Plan",
          stripePriceId: "price_basic_123",
          description: "Basic HRMS features",
          seats: 10,
        },
        {
          name: "Pro Plan",
          stripePriceId: "price_pro_456",
          description: "Advanced features for growing teams",
          seats: 50,
        },
        {
          name: "Enterprise Plan",
          stripePriceId: "price_enterprise_789",
          description: "Enterprise-grade features and support",
          seats: null,
        },
      ])
      .execute();
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "subscription_plans" WHERE "stripePriceId" IN ('price_basic_123','price_pro_456','price_enterprise_789')`,
    );
  }
}
