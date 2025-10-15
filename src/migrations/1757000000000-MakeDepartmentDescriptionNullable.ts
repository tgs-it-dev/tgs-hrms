import { MigrationInterface, QueryRunner } from "typeorm";

export class MakeDepartmentDescriptionNullable1757000000000
  implements MigrationInterface
{
  name = "MakeDepartmentDescriptionNullable1757000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "departments" ALTER COLUMN "description" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "departments" ALTER COLUMN "description" SET NOT NULL`,
    );
  }
}
