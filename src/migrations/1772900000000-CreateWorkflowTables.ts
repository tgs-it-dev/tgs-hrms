import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates workflow_configs, workflow_requests, workflow_steps, wfh_requests
 * and adds workflow_request_id to leaves.
 *
 * Multi-tenant strategy
 * ─────────────────────
 * schema_provisioned = false  → tables live in the shared "public" schema,
 *                               differentiated by tenant_id column.
 * schema_provisioned = true   → tables are created inside the tenant's own
 *                               PostgreSQL schema ("tenant_<uuid_no_hyphens>").
 *
 * The public-schema tables are always created so newly-signed-up tenants have
 * somewhere to land before their schema is provisioned.
 */
export class CreateWorkflowTables1772900000000 implements MigrationInterface {
  name = 'CreateWorkflowTables1772900000000';

  // ── helpers ────────────────────────────────────────────────────────────────

  private getSchemaName(tenantId: string): string {
    return `tenant_${tenantId.replace(/-/g, '')}`;
  }

  private async createTablesInSchema(
    queryRunner: QueryRunner,
    schema: string,
  ): Promise<void> {
    // workflow_configs
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "${schema}"."workflow_configs" (
        "id"            UUID         NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id"     UUID         NOT NULL,
        "request_type"  VARCHAR(32)  NOT NULL,
        "step_order"    SMALLINT     NOT NULL,
        "approver_role" VARCHAR(64)  NOT NULL,
        "step_label"    VARCHAR(128) NOT NULL,
        "is_active"     BOOLEAN      NOT NULL DEFAULT true,
        "created_at"    TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "updated_at"    TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "deleted_at"    TIMESTAMPTZ,
        CONSTRAINT "PK_workflow_configs_${schema}" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_workflow_configs_tenant_type_step_${schema}"
          UNIQUE ("tenant_id", "request_type", "step_order")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_workflow_configs_tenant_type_${schema}"
        ON "${schema}"."workflow_configs" ("tenant_id", "request_type")
    `);

    // workflow_requests
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "${schema}"."workflow_requests" (
        "id"                 UUID        NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id"          UUID        NOT NULL,
        "request_type"       VARCHAR(32) NOT NULL,
        "related_entity_id"  UUID        NOT NULL,
        "requestor_id"       UUID        NOT NULL,
        "status"             VARCHAR(32) NOT NULL DEFAULT 'pending',
        "current_step_order" SMALLINT    NOT NULL DEFAULT 1,
        "total_steps"        SMALLINT    NOT NULL,
        "created_at"         TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"         TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at"         TIMESTAMPTZ,
        CONSTRAINT "PK_workflow_requests_${schema}" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_workflow_requests_tenant_type_${schema}"
        ON "${schema}"."workflow_requests" ("tenant_id", "request_type")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_workflow_requests_tenant_requestor_${schema}"
        ON "${schema}"."workflow_requests" ("tenant_id", "requestor_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_workflow_requests_related_entity_${schema}"
        ON "${schema}"."workflow_requests" ("related_entity_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_workflow_requests_tenant_status_${schema}"
        ON "${schema}"."workflow_requests" ("tenant_id", "status")
    `);

    // workflow_steps (FK to workflow_requests lives in the same schema)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "${schema}"."workflow_steps" (
        "id"                  UUID         NOT NULL DEFAULT gen_random_uuid(),
        "workflow_request_id" UUID         NOT NULL,
        "tenant_id"           UUID         NOT NULL,
        "step_order"          SMALLINT     NOT NULL,
        "approver_role"       VARCHAR(64)  NOT NULL,
        "step_label"          VARCHAR(128) NOT NULL,
        "status"              VARCHAR(32)  NOT NULL DEFAULT 'pending',
        "approver_id"         UUID,
        "remarks"             TEXT,
        "acted_at"            TIMESTAMPTZ,
        "created_at"          TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "updated_at"          TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "deleted_at"          TIMESTAMPTZ,
        CONSTRAINT "PK_workflow_steps_${schema}" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_workflow_steps_request_order_${schema}"
          UNIQUE ("workflow_request_id", "step_order"),
        CONSTRAINT "FK_workflow_steps_request_${schema}"
          FOREIGN KEY ("workflow_request_id")
          REFERENCES "${schema}"."workflow_requests"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_workflow_steps_approver_${schema}"
        ON "${schema}"."workflow_steps" ("approver_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_workflow_steps_tenant_status_${schema}"
        ON "${schema}"."workflow_steps" ("tenant_id", "status")
    `);

    // wfh_requests
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "${schema}"."wfh_requests" (
        "id"                  UUID        NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id"           UUID        NOT NULL,
        "employee_id"         UUID        NOT NULL,
        "wfh_date"            DATE        NOT NULL,
        "reason"              TEXT        NOT NULL,
        "status"              VARCHAR(32) NOT NULL DEFAULT 'pending',
        "workflow_request_id" UUID,
        "created_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at"          TIMESTAMPTZ,
        CONSTRAINT "PK_wfh_requests_${schema}" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_wfh_requests_tenant_employee_${schema}"
        ON "${schema}"."wfh_requests" ("tenant_id", "employee_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_wfh_requests_tenant_status_${schema}"
        ON "${schema}"."wfh_requests" ("tenant_id", "status")
    `);
  }

  private async dropTablesInSchema(
    queryRunner: QueryRunner,
    schema: string,
  ): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "${schema}"."IDX_wfh_requests_tenant_status_${schema}"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "${schema}"."IDX_wfh_requests_tenant_employee_${schema}"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "${schema}"."wfh_requests"`);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "${schema}"."IDX_workflow_steps_tenant_status_${schema}"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "${schema}"."IDX_workflow_steps_approver_${schema}"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "${schema}"."workflow_steps"`);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "${schema}"."IDX_workflow_requests_tenant_status_${schema}"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "${schema}"."IDX_workflow_requests_related_entity_${schema}"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "${schema}"."IDX_workflow_requests_tenant_requestor_${schema}"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "${schema}"."IDX_workflow_requests_tenant_type_${schema}"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "${schema}"."workflow_requests"`);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "${schema}"."IDX_workflow_configs_tenant_type_${schema}"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "${schema}"."workflow_configs"`);
  }

  // ── up ─────────────────────────────────────────────────────────────────────

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Always create tables in public schema (serves non-provisioned tenants
    //    and is available as a landing zone for tenants being provisioned).
    await this.createTablesInSchema(queryRunner, 'public');

    // 2. Add workflow_request_id soft-link to the public leaves table
    await queryRunner.query(`
      ALTER TABLE "public"."leaves"
        ADD COLUMN IF NOT EXISTS "workflow_request_id" UUID
    `);

    // 3. For each provisioned tenant: create tables + add column in their schema
    const provisionedRows: unknown[] = await queryRunner.query(
      `SELECT id FROM public.tenants WHERE schema_provisioned = true`,
    );
    const provisionedTenants = provisionedRows as { id: string }[];

    for (const tenant of provisionedTenants) {
      const schema = this.getSchemaName(tenant.id);
      await this.createTablesInSchema(queryRunner, schema);
      await queryRunner.query(`
        ALTER TABLE "${schema}"."leaves"
          ADD COLUMN IF NOT EXISTS "workflow_request_id" UUID
      `);
    }

    // 4. Seed default WorkflowConfig rows for every tenant in the correct schema
    const allRows: unknown[] = await queryRunner.query(
      `SELECT id, schema_provisioned FROM public.tenants`,
    );
    const allTenants = allRows as { id: string; schema_provisioned: boolean }[];

    for (const tenant of allTenants) {
      const schema = tenant.schema_provisioned
        ? this.getSchemaName(tenant.id)
        : 'public';

      await queryRunner.query(
        `INSERT INTO "${schema}"."workflow_configs"
           (id, tenant_id, request_type, step_order, approver_role, step_label, is_active)
         VALUES
           (gen_random_uuid(), $1, 'leave', 1, 'manager', 'Manager Approval', true),
           (gen_random_uuid(), $1, 'leave', 2, 'admin',   'Admin Approval',   true),
           (gen_random_uuid(), $1, 'wfh',   1, 'manager', 'Manager Approval', true)
         ON CONFLICT (tenant_id, request_type, step_order) DO NOTHING`,
        [tenant.id],
      );
    }
  }

  // ── down ───────────────────────────────────────────────────────────────────

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Clean up each provisioned tenant schema
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const provisionedRowsDown = await queryRunner.query(
      `SELECT id FROM public.tenants WHERE schema_provisioned = true`,
    );
    const provisionedTenants = provisionedRowsDown as unknown as {
      id: string;
    }[];

    for (const tenant of provisionedTenants) {
      const schema = this.getSchemaName(tenant.id);
      await queryRunner.query(`
        ALTER TABLE "${schema}"."leaves"
          DROP COLUMN IF EXISTS "workflow_request_id"
      `);
      await this.dropTablesInSchema(queryRunner, schema);
    }

    // 2. Clean up public schema
    await queryRunner.query(`
      ALTER TABLE "public"."leaves"
        DROP COLUMN IF EXISTS "workflow_request_id"
    `);
    await this.dropTablesInSchema(queryRunner, 'public');
  }
}
