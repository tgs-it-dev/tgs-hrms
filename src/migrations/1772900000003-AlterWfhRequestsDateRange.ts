import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterWfhRequestsDateRange1772900000003
  implements MigrationInterface
{
  name = 'AlterWfhRequestsDateRange1772900000003';

  private getSchemaName(tenantId: string): string {
    return `tenant_${tenantId.replace(/-/g, '')}`;
  }

  private async alterUpInSchema(
    queryRunner: QueryRunner,
    schema: string,
  ): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "${schema}"."wfh_requests" ADD COLUMN IF NOT EXISTS start_date date`,
    );
    await queryRunner.query(
      `ALTER TABLE "${schema}"."wfh_requests" ADD COLUMN IF NOT EXISTS end_date date`,
    );
    await queryRunner.query(
      `UPDATE "${schema}"."wfh_requests" SET start_date = wfh_date, end_date = wfh_date WHERE start_date IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "${schema}"."wfh_requests" ALTER COLUMN start_date SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "${schema}"."wfh_requests" ALTER COLUMN end_date SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "${schema}"."wfh_requests" DROP COLUMN IF EXISTS wfh_date`,
    );
  }

  private async alterDownInSchema(
    queryRunner: QueryRunner,
    schema: string,
  ): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "${schema}"."wfh_requests" ADD COLUMN IF NOT EXISTS wfh_date date`,
    );
    await queryRunner.query(
      `UPDATE "${schema}"."wfh_requests" SET wfh_date = start_date WHERE wfh_date IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "${schema}"."wfh_requests" ALTER COLUMN wfh_date SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "${schema}"."wfh_requests" DROP COLUMN IF EXISTS start_date`,
    );
    await queryRunner.query(
      `ALTER TABLE "${schema}"."wfh_requests" DROP COLUMN IF EXISTS end_date`,
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
