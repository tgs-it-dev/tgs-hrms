import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';
export class ManagerRemarksInLeaves1765896446732 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'leaves',
      new TableColumn({
        name: 'managerRemarks',
        type: 'text',
        isNullable: true,
      }),
    );
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('leaves', 'managerRemarks');
  }
}
