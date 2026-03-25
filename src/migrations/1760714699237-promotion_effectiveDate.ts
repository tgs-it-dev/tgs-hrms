import { MigrationInterface, QueryRunner } from "typeorm";

export class PromotionEffectiveDate1760714699237 implements MigrationInterface {
  name = "PromotionEffectiveDate1760714699237";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "promotions" ALTER COLUMN "effectiveDate" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "promotions" ALTER COLUMN "effectiveDate" SET NOT NULL`,
    );
  }
}
