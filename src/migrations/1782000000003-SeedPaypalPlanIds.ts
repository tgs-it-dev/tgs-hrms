import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedPaypalPlanIds1782000000003 implements MigrationInterface {
  name = 'SeedPaypalPlanIds1782000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "subscription_plans"
         SET "paypalPlanId" = 'P-1X943582P31545045NH5Y4LQ'
       WHERE "name" = 'Basic Plan'
    `);

    await queryRunner.query(`
      UPDATE "subscription_plans"
         SET "paypalPlanId" = 'P-5SX80033NH762250BNH5Y6NA'
       WHERE "name" = 'Pro Plan'
    `);

    await queryRunner.query(`
      UPDATE "subscription_plans"
         SET "paypalPlanId" = 'P-6XA07156RU1243907NH5Y7KA'
       WHERE "name" = 'Enterprise Plan'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "subscription_plans"
         SET "paypalPlanId" = NULL
       WHERE "name" IN ('Basic Plan', 'Pro Plan', 'Enterprise Plan')
    `);
  }
}
