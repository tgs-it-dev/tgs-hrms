import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddShiftsAndAutoCheckout1772900000008
  implements MigrationInterface
{
  name = 'AddShiftsAndAutoCheckout1772900000008';

  private getSchemaName(tenantId: string): string {
    return `tenant_${tenantId.replace(/-/g, '')}`;
  }

  private async applyToSchema(
    queryRunner: QueryRunner,
    schema: string,
  ): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "${schema}"."employees"
        ADD COLUMN IF NOT EXISTS "shift_id" UUID
    `);
    await queryRunner.query(`
      ALTER TABLE "${schema}"."attendance"
        ADD COLUMN IF NOT EXISTS "is_auto_checkout" BOOLEAN NOT NULL DEFAULT false
    `);
  }

  private async revertFromSchema(
    queryRunner: QueryRunner,
    schema: string,
  ): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "${schema}"."employees"
        DROP COLUMN IF EXISTS "shift_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "${schema}"."attendance"
        DROP COLUMN IF EXISTS "is_auto_checkout"
    `);
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create shifts table in public schema
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "public"."shifts" (
        "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
        "name"       VARCHAR(100) NOT NULL,
        "start_time" VARCHAR(5) NOT NULL,
        "end_time"   VARCHAR(5) NOT NULL,
        "tenant_id"  UUID NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_shifts" PRIMARY KEY ("id"),
        CONSTRAINT "FK_shifts_tenant" FOREIGN KEY ("tenant_id")
          REFERENCES "public"."tenants"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_shifts_tenant_id"
        ON "public"."shifts" ("tenant_id")
    `);

    // Apply columns to public schema
    await this.applyToSchema(queryRunner, 'public');

    // Apply to all provisioned tenant schemas (they don't have their own shifts table)
    const rows = (await queryRunner.query(
      `SELECT id FROM public.tenants WHERE schema_provisioned = true`,
    )) as { id: string }[];

    for (const tenant of rows) {
      const schema = this.getSchemaName(tenant.id);

      await queryRunner.query(`
        ALTER TABLE "${schema}"."employees"
          ADD COLUMN IF NOT EXISTS "shift_id" UUID
      `);
      await queryRunner.query(`
        ALTER TABLE "${schema}"."attendance"
          ADD COLUMN IF NOT EXISTS "is_auto_checkout" BOOLEAN NOT NULL DEFAULT false
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const rows = (await queryRunner.query(
      `SELECT id FROM public.tenants WHERE schema_provisioned = true`,
    )) as { id: string }[];

    for (const tenant of rows) {
      const schema = this.getSchemaName(tenant.id);
      await queryRunner.query(`
        ALTER TABLE "${schema}"."employees"
          DROP COLUMN IF EXISTS "shift_id"
      `);
      await queryRunner.query(`
        ALTER TABLE "${schema}"."attendance"
          DROP COLUMN IF EXISTS "is_auto_checkout"
      `);
    }

    await this.revertFromSchema(queryRunner, 'public');

    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_shifts_tenant_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "public"."shifts"`);
  }
}
