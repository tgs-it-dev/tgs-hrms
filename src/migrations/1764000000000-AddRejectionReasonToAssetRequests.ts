import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddRejectionReasonToAssetRequests1764000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'asset_requests',
      new TableColumn({
        name: 'rejection_reason',
        type: 'text',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('asset_requests', 'rejection_reason');
  }
}
