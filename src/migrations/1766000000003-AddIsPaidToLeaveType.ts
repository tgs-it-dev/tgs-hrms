import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIsPaidToLeaveType1766000000003 implements MigrationInterface {
  name = 'AddIsPaidToLeaveType1766000000003'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "leave_types"
      ADD COLUMN "isPaid" boolean NOT NULL DEFAULT true
    `);

    // Optional indexes or data backfill could be added here if needed
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "leave_types" DROP COLUMN "isPaid"
    `);
  }
}


