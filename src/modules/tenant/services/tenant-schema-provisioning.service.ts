import { Injectable, Logger } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";

/**
 * Responsible for provisioning a dedicated PostgreSQL schema for each tenant
 * when they complete their payment.
 *
 * Schema name convention: "tenant_" + tenantId with dashes removed
 * Example: tenant_id "550e8400-e29b-41d4-a716-446655440000"
 *       → schema    "tenant_550e8400e29b41d4a716446655440000"
 *
 * Phase 2 table layout (employee module complete)
 * -----------------------------------------------
 * Tenant schema  : departments, designations, teams, employees,
 *                  billing_transactions
 * Public schema  : users, tenants, company_details, roles, permissions,
 *                  role_permissions, subscription_plans, signup_sessions,
 *                  system_logs
 *
 * ── Identifier length ───────────────────────────────────────────────────────
 * PostgreSQL maximum identifier length is 63 bytes.  The schema name is
 * always exactly 39 chars ("tenant_" + 32 hex digits), so the prefix
 * consumed by every constraint/index name is:
 *
 *   fk_  + schemaName(39)  =  42 chars  →  suffix budget  21 chars
 *   idx_ + schemaName(39)  =  43 chars  →  suffix budget  20 chars
 *   pk_  + schemaName(39)  =  42 chars  →  suffix budget  21 chars
 *   uq_  + schemaName(39)  =  42 chars  →  suffix budget  21 chars
 *
 * All names in this file are kept within those budgets using short
 * abbreviations: dept, desig, emp, bt (billing_transactions), tn (tenant),
 * mgr (manager).
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Cross-schema FK rules:
 *   - Any FK that references a public-schema table uses "public"."table" so
 *     the constraint resolves regardless of the current search_path.
 *   - FKs within the tenant schema use the schemaName prefix.
 *
 * Roles stay in public — they are platform-wide (globally unique names,
 * no tenant_id) and are not per-company data.
 */
@Injectable()
export class TenantSchemaProvisioningService {
  private readonly logger = new Logger(TenantSchemaProvisioningService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Returns the PostgreSQL schema name for a given tenant UUID.
   */
  getSchemaName(tenantId: string): string {
    return `tenant_${tenantId.replace(/-/g, "")}`;
  }

  /**
   * Provisions a dedicated schema and all employee-module tables for the tenant.
   * Idempotent: safe to call multiple times (uses IF NOT EXISTS everywhere).
   *
   * All DDL runs inside a single PostgreSQL transaction.  If any step fails
   * the entire schema is rolled back, leaving the database clean.
   *
   * Creation order (dependency-driven):
   *   1. departments           (no tenant-schema deps)
   *   2. designations          (FK → departments)
   *   3. teams                 (FK → public.users)
   *   4. employees             (FK → designations, teams, public.users)
   *   5. billing_transactions  (FK → public.tenants, employees)
   *
   * After successful provisioning, callers must set tenant.schema_provisioned = true.
   */
  async provisionTenantSchema(tenantId: string): Promise<void> {
    const schemaName = this.getSchemaName(tenantId);
    this.logger.log(
      `Provisioning schema "${schemaName}" for tenant ${tenantId}`,
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
      this.logger.log(`Schema "${schemaName}" ensured`);

      await this.createDepartmentsTable(queryRunner, schemaName);
      await this.createDesignationsTable(queryRunner, schemaName);
      await this.createTeamsTable(queryRunner, schemaName);
      await this.createEmployeesTable(queryRunner, schemaName);
      await this.createBillingTransactionsTable(queryRunner, schemaName);

      // Copy platform-wide GLOBAL departments/designations so new tenants can
      // immediately create designations under them and see them in findAll.
      await this.migrateGlobalDataToTenantSchema(queryRunner, schemaName);

      await queryRunner.commitTransaction();
      this.logger.log(`Schema provisioning complete for tenant ${tenantId}`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Schema provisioning rolled back for tenant ${tenantId}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Upgrades an existing tenant schema to the current Phase 2 table layout.
   *
   * Safe to call on:
   *   - Phase 1 schemas  (only employees table existed, FKs pointed to public)
   *   - Completely new schemas  (no tables at all — creates everything from scratch)
   *   - Already-upgraded schemas  (idempotent — IF NOT EXISTS everywhere)
   *
   * What this does in one transaction:
   *   1. Creates schema if missing.
   *   2. Creates departments, designations, teams, billing_transactions (IF NOT EXISTS).
   *   3. Creates employees table (IF NOT EXISTS — skipped if Phase 1 table exists).
   *   4. Fixes employees FKs — drops old Phase 1 constraints (regardless of their
   *      name/truncation) and re-adds them pointing to the tenant schema tables.
   *
   * After a successful call, callers should set tenant.schema_provisioned = true
   * if it wasn't already.
   */
  async upgradeTenantSchema(tenantId: string): Promise<void> {
    const schemaName = this.getSchemaName(tenantId);
    this.logger.log(`Upgrading schema "${schemaName}" for tenant ${tenantId}`);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

      await this.createDepartmentsTable(queryRunner, schemaName);
      await this.createDesignationsTable(queryRunner, schemaName);
      await this.createTeamsTable(queryRunner, schemaName);
      await this.createEmployeesTable(queryRunner, schemaName);
      await this.createBillingTransactionsTable(queryRunner, schemaName);

      // Fix employees FKs — must run after all tables exist so the new FK
      // targets (designations, teams) are guaranteed to be present.
      await this.upgradeEmployeesForeignKeys(queryRunner, schemaName);

      // Migrate any existing public-schema rows (departments, designations,
      // teams) for this tenant into the new tenant schema tables.  Idempotent:
      // ON CONFLICT DO NOTHING so re-running is always safe.
      await this.migratePublicDataToTenantSchema(queryRunner, schemaName, tenantId);

      await queryRunner.commitTransaction();
      this.logger.log(`Schema upgrade complete for tenant ${tenantId}`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Schema upgrade rolled back for tenant ${tenantId}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Checks whether the schema for a given tenant already exists in PostgreSQL.
   */
  async schemaExists(tenantId: string): Promise<boolean> {
    const schemaName = this.getSchemaName(tenantId);
    const result = await this.dataSource.query<{ exists: boolean }[]>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.schemata WHERE schema_name = $1
       ) AS exists`,
      [schemaName],
    );
    return result[0]?.exists ?? false;
  }

  // ---------------------------------------------------------------------------
  // Private helpers — one method per table, called in dependency order
  // ---------------------------------------------------------------------------

  /**
   * departments
   *   FK: tenant_id → public.tenants
   *
   * Suffix budget used: _dept_tn (8) for FK, _dept_tn (8) for idx
   */
  private async createDepartmentsTable(
    queryRunner: ReturnType<DataSource["createQueryRunner"]>,
    schemaName: string,
  ): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}"."departments" (
        "id"          UUID          NOT NULL DEFAULT gen_random_uuid(),
        "name"        VARCHAR       NOT NULL,
        "description" TEXT,
        "tenant_id"   UUID          NOT NULL,
        "created_at"  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        CONSTRAINT "pk_${schemaName}_dept"
          PRIMARY KEY ("id"),
        CONSTRAINT "fk_${schemaName}_dept_tn"
          FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants" ("id")
          ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_${schemaName}_dept_tn"
         ON "${schemaName}"."departments" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_${schemaName}_dept_name"
         ON "${schemaName}"."departments" ("name")`,
    );
    this.logger.debug(`Table "${schemaName}".departments ensured`);
  }

  /**
   * designations
   *   FK: department_id → <tenant schema>.departments
   *   FK: tenant_id     → public.tenants
   *
   * Suffix budget used: _desig_dept (11), _desig_tn (9)
   */
  private async createDesignationsTable(
    queryRunner: ReturnType<DataSource["createQueryRunner"]>,
    schemaName: string,
  ): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}"."designations" (
        "id"            UUID        NOT NULL DEFAULT gen_random_uuid(),
        "title"         VARCHAR     NOT NULL,
        "department_id" UUID        NOT NULL,
        "tenant_id"     UUID        NOT NULL,
        "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "pk_${schemaName}_desig"
          PRIMARY KEY ("id"),
        CONSTRAINT "fk_${schemaName}_desig_dept"
          FOREIGN KEY ("department_id") REFERENCES "${schemaName}"."departments" ("id")
          ON DELETE CASCADE,
        CONSTRAINT "fk_${schemaName}_desig_tn"
          FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants" ("id")
          ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_${schemaName}_desig_tn"
         ON "${schemaName}"."designations" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_${schemaName}_desig_dept"
         ON "${schemaName}"."designations" ("department_id")`,
    );
    this.logger.debug(`Table "${schemaName}".designations ensured`);
  }

  /**
   * teams
   *   FK: manager_id → public.users  (manager is always a shared user)
   *   No tenant_id column — tenancy is implicit via the manager's user record.
   *
   * Suffix budget used: _teams_mgr (10)
   */
  private async createTeamsTable(
    queryRunner: ReturnType<DataSource["createQueryRunner"]>,
    schemaName: string,
  ): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}"."teams" (
        "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
        "name"        VARCHAR     NOT NULL,
        "description" TEXT,
        "manager_id"  UUID        NOT NULL,
        "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "pk_${schemaName}_teams"
          PRIMARY KEY ("id"),
        CONSTRAINT "fk_${schemaName}_teams_mgr"
          FOREIGN KEY ("manager_id") REFERENCES "public"."users" ("id")
          ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_${schemaName}_teams_mgr"
         ON "${schemaName}"."teams" ("manager_id")`,
    );
    this.logger.debug(`Table "${schemaName}".teams ensured`);
  }

  /**
   * employees
   *   FK: user_id        → public.users              (shared login table)
   *   FK: designation_id → <tenant schema>.designations
   *   FK: team_id        → <tenant schema>.teams
   *
   * Suffix budget used: _emp_user (9), _emp_desig (10), _emp_team (9)
   */
  private async createEmployeesTable(
    queryRunner: ReturnType<DataSource["createQueryRunner"]>,
    schemaName: string,
  ): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}"."employees" (
        "id"                UUID        NOT NULL DEFAULT gen_random_uuid(),
        "user_id"           UUID        NOT NULL,
        "designation_id"    UUID        NOT NULL,
        "status"            VARCHAR(20) NOT NULL DEFAULT 'active',
        "invite_status"     VARCHAR(20) NOT NULL DEFAULT 'invite_sent',
        "team_id"           UUID,
        "cnic_number"       VARCHAR(15),
        "cnic_picture"      VARCHAR(500),
        "cnic_back_picture" VARCHAR(500),
        "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at"        TIMESTAMPTZ,
        CONSTRAINT "pk_${schemaName}_emp"
          PRIMARY KEY ("id"),
        CONSTRAINT "uq_${schemaName}_emp_cnic"
          UNIQUE ("cnic_number"),
        CONSTRAINT "fk_${schemaName}_emp_user"
          FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id")
          ON DELETE CASCADE,
        CONSTRAINT "fk_${schemaName}_emp_desig"
          FOREIGN KEY ("designation_id") REFERENCES "${schemaName}"."designations" ("id")
          ON DELETE RESTRICT,
        CONSTRAINT "fk_${schemaName}_emp_team"
          FOREIGN KEY ("team_id") REFERENCES "${schemaName}"."teams" ("id")
          ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_${schemaName}_emp_user"
         ON "${schemaName}"."employees" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_${schemaName}_emp_desig"
         ON "${schemaName}"."employees" ("designation_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_${schemaName}_emp_team"
         ON "${schemaName}"."employees" ("team_id")`,
    );
    this.logger.debug(`Table "${schemaName}".employees ensured`);
  }

  /**
   * billing_transactions
   *   FK: tenant_id   → public.tenants               (cross-schema)
   *   FK: employee_id → <tenant schema>.employees     (within schema — restored)
   *
   * Suffix budget used: _bt_tn (6), _bt_emp (7)
   *
   * FKs are added via separate idempotent DO $$ blocks (not inline in CREATE
   * TABLE) so that a retry after a partial failure never hits
   * "constraint already exists".
   */
  private async createBillingTransactionsTable(
    queryRunner: ReturnType<DataSource["createQueryRunner"]>,
    schemaName: string,
  ): Promise<void> {
    // Create table without inline FK constraints — FKs are added below.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}"."billing_transactions" (
        "id"                 UUID           NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id"          UUID           NOT NULL,
        "type"               VARCHAR(50)    NOT NULL,
        "status"             VARCHAR(20)    NOT NULL,
        "amount"             NUMERIC(10,2)  NOT NULL,
        "currency"           VARCHAR(3)     NOT NULL DEFAULT 'USD',
        "stripe_charge_id"   VARCHAR,
        "stripe_customer_id" VARCHAR,
        "employee_id"        UUID,
        "description"        TEXT,
        "error_message"      TEXT,
        "metadata"           JSONB,
        "created_at"         TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
        "updated_at"         TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
        CONSTRAINT "pk_${schemaName}_bt"
          PRIMARY KEY ("id")
      )
    `);

    // Tenant FK — idempotent
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_schema = '${schemaName}'
            AND table_name   = 'billing_transactions'
            AND constraint_name = 'fk_${schemaName}_bt_tn'
        ) THEN
          ALTER TABLE "${schemaName}"."billing_transactions"
            ADD CONSTRAINT "fk_${schemaName}_bt_tn"
            FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants" ("id")
            ON DELETE NO ACTION;
        END IF;
      END $$;
    `);

    // Employee FK — idempotent
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_schema = '${schemaName}'
            AND table_name   = 'billing_transactions'
            AND constraint_name = 'fk_${schemaName}_bt_emp'
        ) THEN
          ALTER TABLE "${schemaName}"."billing_transactions"
            ADD CONSTRAINT "fk_${schemaName}_bt_emp"
            FOREIGN KEY ("employee_id")
            REFERENCES "${schemaName}"."employees" ("id")
            ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_${schemaName}_bt_tn"
         ON "${schemaName}"."billing_transactions" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_${schemaName}_bt_status"
         ON "${schemaName}"."billing_transactions" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_${schemaName}_bt_created"
         ON "${schemaName}"."billing_transactions" ("created_at")`,
    );
    this.logger.debug(`Table "${schemaName}".billing_transactions ensured`);
  }

  /**
   * Fixes the two FK constraints on the employees table that changed between
   * Phase 1 and Phase 2:
   *
   *   Phase 1: designation_id → public.designations
   *   Phase 2: designation_id → <tenant schema>.designations
   *
   *   Phase 1: team_id → public.teams
   *   Phase 2: team_id → <tenant schema>.teams
   *
   * Uses pg_constraint to locate the existing FK by COLUMN NAME rather than
   * by constraint name.  This is necessary because Phase 1 constraint names
   * exceeded PostgreSQL's 63-char identifier limit and were silently truncated,
   * making them impossible to look up reliably via information_schema string
   * comparison.
   *
   * After dropping the old FK (whatever name it was stored under), a new FK
   * with a short, budget-safe name is added.  The whole operation is idempotent:
   * if the new FK already exists the DO block skips both the drop and the add.
   */
  private async upgradeEmployeesForeignKeys(
    queryRunner: ReturnType<DataSource["createQueryRunner"]>,
    schemaName: string,
  ): Promise<void> {
    // ── designation_id FK ────────────────────────────────────────────────────
    await queryRunner.query(`
      DO $$
      DECLARE
        v_con text;
      BEGIN
        -- Already upgraded?
        IF EXISTS (
          SELECT 1 FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
          JOIN pg_namespace n ON n.oid = t.relnamespace
          WHERE c.contype = 'f'
            AND n.nspname = '${schemaName}'
            AND t.relname = 'employees'
            AND c.conname = 'fk_${schemaName}_emp_desig'
        ) THEN
          RETURN;
        END IF;

        -- Find and drop the old FK on designation_id (any name)
        SELECT c.conname INTO v_con
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = c.conkey[1]
        WHERE c.contype = 'f'
          AND n.nspname = '${schemaName}'
          AND t.relname = 'employees'
          AND a.attname = 'designation_id'
        LIMIT 1;

        IF v_con IS NOT NULL THEN
          EXECUTE format(
            'ALTER TABLE %I.employees DROP CONSTRAINT %I',
            '${schemaName}', v_con
          );
        END IF;

        ALTER TABLE "${schemaName}"."employees"
          ADD CONSTRAINT "fk_${schemaName}_emp_desig"
          FOREIGN KEY ("designation_id")
          REFERENCES "${schemaName}"."designations" ("id")
          ON DELETE RESTRICT;
      END $$;
    `);

    // ── team_id FK ───────────────────────────────────────────────────────────
    await queryRunner.query(`
      DO $$
      DECLARE
        v_con text;
      BEGIN
        -- Already upgraded?
        IF EXISTS (
          SELECT 1 FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
          JOIN pg_namespace n ON n.oid = t.relnamespace
          WHERE c.contype = 'f'
            AND n.nspname = '${schemaName}'
            AND t.relname = 'employees'
            AND c.conname = 'fk_${schemaName}_emp_team'
        ) THEN
          RETURN;
        END IF;

        -- Find and drop the old FK on team_id (any name)
        SELECT c.conname INTO v_con
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = c.conkey[1]
        WHERE c.contype = 'f'
          AND n.nspname = '${schemaName}'
          AND t.relname = 'employees'
          AND a.attname = 'team_id'
        LIMIT 1;

        IF v_con IS NOT NULL THEN
          EXECUTE format(
            'ALTER TABLE %I.employees DROP CONSTRAINT %I',
            '${schemaName}', v_con
          );
        END IF;

        ALTER TABLE "${schemaName}"."employees"
          ADD CONSTRAINT "fk_${schemaName}_emp_team"
          FOREIGN KEY ("team_id")
          REFERENCES "${schemaName}"."teams" ("id")
          ON DELETE SET NULL;
      END $$;
    `);

    this.logger.debug(
      `Employees FKs upgraded to tenant schema for "${schemaName}"`,
    );
  }

  /**
   * Copies existing public-schema rows for this tenant into the tenant schema.
   *
   * Called as the last step of upgradeTenantSchema so that all target tables
   * already exist.  Each INSERT uses ON CONFLICT (id) DO NOTHING, making the
   * whole method fully idempotent.
   *
   * Copy order (FK dependency):
   *   1. departments   — no intra-tenant FK dependencies
   *   2. designations  — FK → tenant schema departments
   *   3. teams         — FK → public.users (manager_id); no intra-tenant FK
   *
   * Designations that reference a department not in the tenant schema
   * (e.g. legacy GLOBAL departments whose tenant_id differs) are skipped via
   * the EXISTS sub-query to avoid FK violations.
   *
   * Teams have no tenant_id column; they are identified by joining public.users
   * on manager_id and filtering by tenant_id there.
   */
  private async migratePublicDataToTenantSchema(
    queryRunner: ReturnType<DataSource["createQueryRunner"]>,
    schemaName: string,
    tenantId: string,
  ): Promise<void> {
    // ── departments ──────────────────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO "${schemaName}"."departments"
        (id, name, description, tenant_id, created_at)
      SELECT
        d.id,
        d.name,
        d.description,
        d.tenant_id,
        d.created_at
      FROM public.departments d
      WHERE d.tenant_id = $1
      ON CONFLICT (id) DO NOTHING
    `, [tenantId]);

    // ── designations — only those whose department already landed above ──────
    await queryRunner.query(`
      INSERT INTO "${schemaName}"."designations"
        (id, title, department_id, tenant_id, created_at)
      SELECT
        dg.id,
        dg.title,
        dg.department_id,
        dg.tenant_id,
        dg.created_at
      FROM public.designations dg
      WHERE dg.tenant_id = $1
        AND EXISTS (
          SELECT 1
          FROM "${schemaName}"."departments" dep
          WHERE dep.id = dg.department_id
        )
      ON CONFLICT (id) DO NOTHING
    `, [tenantId]);

    // ── teams — identified via manager's tenant_id in public.users ───────────
    await queryRunner.query(`
      INSERT INTO "${schemaName}"."teams"
        (id, name, description, manager_id, created_at)
      SELECT
        t.id,
        t.name,
        t.description,
        t.manager_id,
        t.created_at
      FROM public.teams t
      JOIN public.users u ON u.id = t.manager_id
      WHERE u.tenant_id = $1
      ON CONFLICT (id) DO NOTHING
    `, [tenantId]);

    // Also ensure GLOBAL (platform-wide) departments and designations are
    // present so that provisioned tenants can see and use them.
    await this.migrateGlobalDataToTenantSchema(queryRunner, schemaName);

    this.logger.log(
      `Public-schema data migrated to tenant schema "${schemaName}" for tenant ${tenantId}`,
    );
  }

  /**
   * Copies platform-wide GLOBAL departments and designations
   * (tenant_id = '00000000-0000-0000-0000-000000000000') from the public
   * schema into the tenant schema.
   *
   * The INSERT is guarded by an EXISTS sub-select that checks whether the
   * GLOBAL pseudo-tenant exists in public.tenants.  If it does not (unusual
   * setup), no rows are selected and no FK violation occurs.
   *
   * Idempotent: ON CONFLICT (id) DO NOTHING.
   */
  private async migrateGlobalDataToTenantSchema(
    queryRunner: ReturnType<DataSource["createQueryRunner"]>,
    schemaName: string,
  ): Promise<void> {
    const GLOBAL = "00000000-0000-0000-0000-000000000000";

    // ── GLOBAL departments ───────────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO "${schemaName}"."departments"
        (id, name, description, tenant_id, created_at)
      SELECT
        d.id,
        d.name,
        d.description,
        d.tenant_id,
        d.created_at
      FROM public.departments d
      WHERE d.tenant_id = $1
        AND EXISTS (
          SELECT 1 FROM public.tenants WHERE id = $1
        )
      ON CONFLICT (id) DO NOTHING
    `, [GLOBAL]);

    // ── GLOBAL designations (only those referencing a GLOBAL department) ─────
    await queryRunner.query(`
      INSERT INTO "${schemaName}"."designations"
        (id, title, department_id, tenant_id, created_at)
      SELECT
        dg.id,
        dg.title,
        dg.department_id,
        dg.tenant_id,
        dg.created_at
      FROM public.designations dg
      WHERE dg.tenant_id = $1
        AND EXISTS (
          SELECT 1
          FROM "${schemaName}"."departments" dep
          WHERE dep.id = dg.department_id
        )
      ON CONFLICT (id) DO NOTHING
    `, [GLOBAL]);

    this.logger.debug(
      `GLOBAL departments/designations ensured in tenant schema "${schemaName}"`,
    );
  }
}
