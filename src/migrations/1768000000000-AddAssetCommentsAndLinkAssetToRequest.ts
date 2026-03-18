import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex, TableColumn } from 'typeorm';

export class AddAssetCommentsAndLinkAssetToRequest1768000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add asset_id column to asset_requests table
    await queryRunner.addColumn(
      'asset_requests',
      new TableColumn({
        name: 'asset_id',
        type: 'uuid',
        isNullable: true,
      }),
    );

    // Create asset_comments table
    await queryRunner.createTable(
      new Table({
        name: 'asset_comments',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'asset_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'commented_by',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'comment',
            type: 'text',
            isNullable: false,
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
        ],
      }),
      true,
    );

    // Create indexes for asset_comments
    await queryRunner.createIndex(
      'asset_comments',
      new TableIndex({
        name: 'IDX_asset_comments_asset_id',
        columnNames: ['asset_id'],
      }),
    );

    await queryRunner.createIndex(
      'asset_comments',
      new TableIndex({
        name: 'IDX_asset_comments_commented_by',
        columnNames: ['commented_by'],
      }),
    );

    await queryRunner.createIndex(
      'asset_comments',
      new TableIndex({
        name: 'IDX_asset_comments_tenant_id',
        columnNames: ['tenant_id'],
      }),
    );

    // Add foreign key constraint for asset_requests.asset_id
    await queryRunner.createForeignKey(
      'asset_requests',
      new TableForeignKey({
        columnNames: ['asset_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'assets',
        onDelete: 'SET NULL',
      }),
    );

    // Add foreign key constraints for asset_comments
    await queryRunner.createForeignKey(
      'asset_comments',
      new TableForeignKey({
        columnNames: ['asset_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'assets',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'asset_comments',
      new TableForeignKey({
        columnNames: ['commented_by'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'RESTRICT',
      }),
    );

    await queryRunner.createForeignKey(
      'asset_comments',
      new TableForeignKey({
        columnNames: ['tenant_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'tenants',
        onDelete: 'RESTRICT',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraints for asset_comments
    const assetCommentsTable = await queryRunner.getTable('asset_comments');
    if (assetCommentsTable) {
      const foreignKeys = assetCommentsTable.foreignKeys;
      for (const fk of foreignKeys) {
        await queryRunner.dropForeignKey('asset_comments', fk);
      }
    }

    // Drop foreign key constraint for asset_requests.asset_id
    const assetRequestsTable = await queryRunner.getTable('asset_requests');
    if (assetRequestsTable) {
      const assetForeignKey = assetRequestsTable.foreignKeys.find(
        (fk) => fk.columnNames.indexOf('asset_id') !== -1,
      );
      if (assetForeignKey) {
        await queryRunner.dropForeignKey('asset_requests', assetForeignKey);
      }
    }

    // Drop indexes
    await queryRunner.dropIndex('asset_comments', 'IDX_asset_comments_tenant_id');
    await queryRunner.dropIndex('asset_comments', 'IDX_asset_comments_commented_by');
    await queryRunner.dropIndex('asset_comments', 'IDX_asset_comments_asset_id');

    // Drop asset_comments table
    await queryRunner.dropTable('asset_comments');

    // Drop asset_id column from asset_requests
    await queryRunner.dropColumn('asset_requests', 'asset_id');
  }
}

