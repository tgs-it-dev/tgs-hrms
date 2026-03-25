import { MigrationInterface, QueryRunner } from "typeorm";

export class PerformanceReviewStatus1760618120949
  implements MigrationInterface
{
  name = "PerformanceReviewStatus1760618120949";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "performance_reviews" ALTER COLUMN "status" SET DEFAULT 'under_review'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "performance_reviews" ALTER COLUMN "status" SET DEFAULT 'pending'`,
    );
  }
}
