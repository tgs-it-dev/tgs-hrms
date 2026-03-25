import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateTasksTables1767000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create tasks table
    await queryRunner.createTable(
      new Table({
        name: 'tasks',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'title',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'assigned_to',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'team_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'created_by',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'varchar',
            default: "'pending'",
            isNullable: false,
          },
          {
            name: 'deadline',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'priority',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'tenant_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create task_history table
    await queryRunner.createTable(
      new Table({
        name: 'task_history',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'task_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'previous_status',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'new_status',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'changed_by',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'remarks',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create indexes for tasks table
    await queryRunner.createIndex(
      'tasks',
      new TableIndex({
        name: 'IDX_tasks_assigned_to',
        columnNames: ['assigned_to'],
      }),
    );

    await queryRunner.createIndex(
      'tasks',
      new TableIndex({
        name: 'IDX_tasks_team_id',
        columnNames: ['team_id'],
      }),
    );

    await queryRunner.createIndex(
      'tasks',
      new TableIndex({
        name: 'IDX_tasks_tenant_id',
        columnNames: ['tenant_id'],
      }),
    );

    await queryRunner.createIndex(
      'tasks',
      new TableIndex({
        name: 'IDX_tasks_status',
        columnNames: ['status'],
      }),
    );

    // Create indexes for task_history table
    await queryRunner.createIndex(
      'task_history',
      new TableIndex({
        name: 'IDX_task_history_task_id',
        columnNames: ['task_id'],
      }),
    );

    await queryRunner.createIndex(
      'task_history',
      new TableIndex({
        name: 'IDX_task_history_changed_by',
        columnNames: ['changed_by'],
      }),
    );

    // Create foreign key constraints for tasks table
    await queryRunner.createForeignKey(
      'tasks',
      new TableForeignKey({
        columnNames: ['assigned_to'],
        referencedColumnNames: ['id'],
        referencedTableName: 'employees',
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createForeignKey(
      'tasks',
      new TableForeignKey({
        columnNames: ['team_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'teams',
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createForeignKey(
      'tasks',
      new TableForeignKey({
        columnNames: ['created_by'],
        referencedColumnNames: ['id'],
        referencedTableName: 'employees',
        onDelete: 'RESTRICT',
      }),
    );

    await queryRunner.createForeignKey(
      'tasks',
      new TableForeignKey({
        columnNames: ['tenant_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'tenants',
        onDelete: 'RESTRICT',
      }),
    );

    // Create foreign key constraints for task_history table
    await queryRunner.createForeignKey(
      'task_history',
      new TableForeignKey({
        columnNames: ['task_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'tasks',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'task_history',
      new TableForeignKey({
        columnNames: ['changed_by'],
        referencedColumnNames: ['id'],
        referencedTableName: 'employees',
        onDelete: 'RESTRICT',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraints for task_history table
    const taskHistoryTable = await queryRunner.getTable('task_history');
    if (taskHistoryTable) {
      const foreignKeys = taskHistoryTable.foreignKeys;
      for (const fk of foreignKeys) {
        await queryRunner.dropForeignKey('task_history', fk);
      }
    }

    // Drop foreign key constraints for tasks table
    const tasksTable = await queryRunner.getTable('tasks');
    if (tasksTable) {
      const foreignKeys = tasksTable.foreignKeys;
      for (const fk of foreignKeys) {
        await queryRunner.dropForeignKey('tasks', fk);
      }
    }

    // Drop indexes
    await queryRunner.dropIndex('task_history', 'IDX_task_history_changed_by');
    await queryRunner.dropIndex('task_history', 'IDX_task_history_task_id');
    await queryRunner.dropIndex('tasks', 'IDX_tasks_status');
    await queryRunner.dropIndex('tasks', 'IDX_tasks_tenant_id');
    await queryRunner.dropIndex('tasks', 'IDX_tasks_team_id');
    await queryRunner.dropIndex('tasks', 'IDX_tasks_assigned_to');

    // Drop tables
    await queryRunner.dropTable('task_history');
    await queryRunner.dropTable('tasks');
  }
}

