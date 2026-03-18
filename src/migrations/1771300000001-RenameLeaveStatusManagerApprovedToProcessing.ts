import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameLeaveStatusManagerApprovedToProcessing1771300000001
  implements MigrationInterface
{
  name = 'RenameLeaveStatusManagerApprovedToProcessing1771300000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE leaves SET status = 'processing' WHERE status = 'manager_approved'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE leaves SET status = 'manager_approved' WHERE status = 'processing'`,
    );
  }
}
