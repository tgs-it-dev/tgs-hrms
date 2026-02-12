import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Makes user email globally unique across the entire database (all tenants).
 * - Reverts the trigger from per-tenant uniqueness to global uniqueness.
 * - Drops the composite (email, tenant_id) index from AllowMultiTenantEmail.
 * - Adds a UNIQUE constraint on users.email.
 *
 * Note: If you have existing rows with the same email in different tenants,
 * the ADD CONSTRAINT step will fail. Resolve duplicates before running.
 */
export class MakeUserEmailGloballyUnique1772100000000
  implements MigrationInterface
{
  name = 'MakeUserEmailGloballyUnique1772100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop trigger so we can replace the function
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_prevent_duplicate_user_email ON users;
    `);

    // Enforce global email uniqueness (one email in the whole DB)
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_duplicate_user_email()
      RETURNS trigger AS $$
      BEGIN
        IF TG_OP = 'UPDATE' AND NEW.email = OLD.email THEN
          RETURN NEW;
        END IF;

        IF EXISTS (SELECT 1 FROM users WHERE email = NEW.email) THEN
          RAISE EXCEPTION 'Email "%" already exists', NEW.email
            USING ERRCODE = '23505';
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE TRIGGER trg_prevent_duplicate_user_email
      BEFORE INSERT OR UPDATE ON users
      FOR EACH ROW
      EXECUTE FUNCTION prevent_duplicate_user_email();
    `);

    // Drop composite index from AllowMultiTenantEmail (no longer needed for uniqueness)
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_users_email_tenant;
    `);

    // Drop composite unique index if it was created by TypeORM sync (email, tenant_id)
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_users_email_tenant_id";
    `);

    // Add UNIQUE constraint on email so it is globally unique
    await queryRunner.query(`
      ALTER TABLE "users" ADD CONSTRAINT "UQ_users_email" UNIQUE ("email");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "UQ_users_email";
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email_tenant ON users (email, tenant_id);
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_prevent_duplicate_user_email ON users;
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_duplicate_user_email()
      RETURNS trigger AS $$
      BEGIN
        IF TG_OP = 'UPDATE' AND NEW.email = OLD.email AND NEW.tenant_id = OLD.tenant_id THEN
          RETURN NEW;
        END IF;

        IF EXISTS (SELECT 1 FROM users WHERE email = NEW.email AND tenant_id = NEW.tenant_id) THEN
          RAISE EXCEPTION 'Email "%" already exists in this organization', NEW.email
            USING ERRCODE = '23505';
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE TRIGGER trg_prevent_duplicate_user_email
      BEFORE INSERT OR UPDATE ON users
      FOR EACH ROW
      EXECUTE FUNCTION prevent_duplicate_user_email();
    `);
  }
}
