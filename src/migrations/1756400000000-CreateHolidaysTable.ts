import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateHolidaysTable1756400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create holidays table
    await queryRunner.createTable(
      new Table({
        name: 'holidays',
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
            name: 'date',
            type: 'date',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
            isNullable: false,
          },
          {
            name: 'tenant_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Add foreign key constraint to tenants table
    await queryRunner.createForeignKey(
      'holidays',
      new TableForeignKey({
        columnNames: ['tenant_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'tenants',
        onDelete: 'CASCADE',
      }),
    );

    // Create unique index on tenant_id and date to prevent duplicate holidays
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_holidays_tenant_date" ON "holidays" ("tenant_id", "date")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop unique index
    await queryRunner.query(`DROP INDEX "IDX_holidays_tenant_date"`);

    // Remove foreign key constraint
    const holidaysTable = await queryRunner.getTable('holidays');
    if (holidaysTable) {
      const tenantForeignKey = holidaysTable.foreignKeys.find(
        (fk) => fk.columnNames.indexOf('tenant_id') !== -1,
      );
      if (tenantForeignKey) {
        await queryRunner.dropForeignKey('holidays', tenantForeignKey);
      }
    }

    // Drop holidays table
    await queryRunner.dropTable('holidays');
  }
}
