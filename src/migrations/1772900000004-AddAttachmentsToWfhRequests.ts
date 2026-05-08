import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAttachmentsToWfhRequests1772900000004
  implements MigrationInterface
{
  name = 'AddAttachmentsToWfhRequests1772900000004';

  private getSchemaName(tenantId: string): string {
    return `tenant_${tenantId.replace(/-/g, '')}`;
  }

  private async alterUpInSchema(
    queryRunner: QueryRunner,
    schema: string,
  ): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "${schema}"."wfh_requests" ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'`,
    );
  }

  private async alterDownInSchema(
    queryRunner: QueryRunner,
    schema: string,
  ): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "${schema}"."wfh_requests" DROP COLUMN IF EXISTS attachments`,
    );
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.alterUpInSchema(queryRunner, 'public');

    const rows = (await queryRunner.query(
      `SELECT id FROM public.tenants WHERE schema_provisioned = true`,
    )) as { id: string }[];

    for (const tenant of rows) {
      await this.alterUpInSchema(queryRunner, this.getSchemaName(tenant.id));
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const rows = (await queryRunner.query(
      `SELECT id FROM public.tenants WHERE schema_provisioned = true`,
    )) as { id: string }[];

    for (const tenant of rows) {
      await this.alterDownInSchema(queryRunner, this.getSchemaName(tenant.id));
    }

    await this.alterDownInSchema(queryRunner, 'public');
  }
}
