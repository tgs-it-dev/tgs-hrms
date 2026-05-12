import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWorkflowRequestIdToLeaves1772900000006
  implements MigrationInterface
{
  name = 'AddWorkflowRequestIdToLeaves1772900000006';

  private getSchemaName(tenantId: string): string {
    return `tenant_${tenantId.replace(/-/g, '')}`;
  }

  private async addColumnToSchema(
    queryRunner: QueryRunner,
    schema: string,
  ): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "${schema}"."leaves"
        ADD COLUMN IF NOT EXISTS "workflow_request_id" UUID
    `);
  }

  private async dropColumnFromSchema(
    queryRunner: QueryRunner,
    schema: string,
  ): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "${schema}"."leaves"
        DROP COLUMN IF EXISTS "workflow_request_id"
    `);
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.addColumnToSchema(queryRunner, 'public');

    const rows = (await queryRunner.query(
      `SELECT id FROM public.tenants WHERE schema_provisioned = true`,
    )) as { id: string }[];

    for (const tenant of rows) {
      await this.addColumnToSchema(queryRunner, this.getSchemaName(tenant.id));
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const rows = (await queryRunner.query(
      `SELECT id FROM public.tenants WHERE schema_provisioned = true`,
    )) as { id: string }[];

    for (const tenant of rows) {
      await this.dropColumnFromSchema(
        queryRunner,
        this.getSchemaName(tenant.id),
      );
    }

    await this.dropColumnFromSchema(queryRunner, 'public');
  }
}
