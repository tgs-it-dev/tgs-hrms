import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNearBoundaryToAttendance1771200000004 implements MigrationInterface {
  name = 'AddNearBoundaryToAttendance1771200000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE attendance
        ADD COLUMN IF NOT EXISTS near_boundary boolean NOT NULL DEFAULT false;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE attendance
        DROP COLUMN IF EXISTS near_boundary;
    `);
  }
}
