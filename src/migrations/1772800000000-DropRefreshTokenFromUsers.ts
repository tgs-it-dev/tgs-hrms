import { MigrationInterface, QueryRunner } from "typeorm";

export class DropRefreshTokenFromUsers1772800000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "refresh_token"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "refresh_token" text`,
    );
  }
}
