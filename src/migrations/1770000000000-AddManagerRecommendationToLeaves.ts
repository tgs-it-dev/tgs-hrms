import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey } from 'typeorm';

export class AddManagerRecommendationToLeaves1770000000000 implements MigrationInterface {
  name = 'AddManagerRecommendationToLeaves1770000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add manager recommendation fields
    await queryRunner.addColumn(
      'leaves',
      new TableColumn({
        name: 'managerRecommendation',
        type: 'varchar',
        length: '20',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'leaves',
      new TableColumn({
        name: 'recommendedBy',
        type: 'uuid',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'leaves',
      new TableColumn({
        name: 'recommendedAt',
        type: 'timestamp',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'leaves',
      new TableColumn({
        name: 'managerRemarks',
        type: 'text',
        isNullable: true,
      }),
    );

    // Add foreign key constraint for recommendedBy
    await queryRunner.createForeignKey(
      'leaves',
      new TableForeignKey({
        columnNames: ['recommendedBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Get the table to find foreign key name
    const table = await queryRunner.getTable('leaves');
    const foreignKey = table?.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('recommendedBy') !== -1,
    );

    if (foreignKey) {
      await queryRunner.dropForeignKey('leaves', foreignKey);
    }

    // Drop columns
    await queryRunner.dropColumn('leaves', 'managerRemarks');
    await queryRunner.dropColumn('leaves', 'recommendedAt');
    await queryRunner.dropColumn('leaves', 'recommendedBy');
    await queryRunner.dropColumn('leaves', 'managerRecommendation');
  }
}

