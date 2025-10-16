import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableColumn } from 'typeorm';

export class CreateTeamsTable1755612048000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create teams table
    await queryRunner.createTable(
      new Table({
        name: 'teams',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'name',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'manager_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Add team_id column to employees table
    await queryRunner.addColumn(
      'employees',
      new TableColumn({
        name: 'team_id',
        type: 'uuid',
        isNullable: true,
      }),
    );

    // Add foreign key constraints
    await queryRunner.createForeignKey(
      'teams',
      new TableForeignKey({
        columnNames: ['manager_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'employees',
      new TableForeignKey({
        columnNames: ['team_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'teams',
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove foreign key constraints
    const employeesTable = await queryRunner.getTable('employees');
    if (employeesTable) {
      const teamForeignKey = employeesTable.foreignKeys.find(
        (fk) => fk.columnNames.indexOf('team_id') !== -1,
      );
      if (teamForeignKey) {
        await queryRunner.dropForeignKey('employees', teamForeignKey);
      }
    }

    const teamsTable = await queryRunner.getTable('teams');
    if (teamsTable) {
      const managerForeignKey = teamsTable.foreignKeys.find(
        (fk) => fk.columnNames.indexOf('manager_id') !== -1,
      );
      if (managerForeignKey) {
        await queryRunner.dropForeignKey('teams', managerForeignKey);
      }
    }

    // Remove team_id column from employees
    await queryRunner.dropColumn('employees', 'team_id');

    // Drop teams table
    await queryRunner.dropTable('teams');
  }
}
