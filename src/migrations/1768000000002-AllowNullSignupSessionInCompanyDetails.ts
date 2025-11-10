import { MigrationInterface, QueryRunner } from "typeorm";

export class AllowNullSignupSessionInCompanyDetails1768000000002
  implements MigrationInterface
{
  name = "AllowNullSignupSessionInCompanyDetails1768000000002";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "company_details" ALTER COLUMN "signup_session_id" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "company_details" ALTER COLUMN "signup_session_id" SET NOT NULL`,
    );
  }
}
