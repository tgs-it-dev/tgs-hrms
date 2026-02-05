import { MigrationInterface, QueryRunner } from "typeorm";

export class AllowMultiTenantEmail1772000000000 implements MigrationInterface {
    name = "AllowMultiTenantEmail1772000000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Drop existing trigger
        await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_prevent_duplicate_user_email ON users;
    `);

        // Update the function to check for (email, tenant_id) uniqueness
        await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_duplicate_user_email()
      RETURNS trigger AS $$
      BEGIN
        -- If email and tenant_id are unchanged on UPDATE, allow it
        IF TG_OP = 'UPDATE' AND NEW.email = OLD.email AND NEW.tenant_id = OLD.tenant_id THEN
          RETURN NEW;
        END IF;

        -- Check if an email already exists WITHIN THE SAME TENANT
        IF EXISTS (SELECT 1 FROM users WHERE email = NEW.email AND tenant_id = NEW.tenant_id) THEN
          RAISE EXCEPTION 'Email "%" already exists in this organization', NEW.email
            USING ERRCODE = '23505';
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

        // Re-attach the trigger
        await queryRunner.query(`
      CREATE TRIGGER trg_prevent_duplicate_user_email
      BEFORE INSERT OR UPDATE ON users
      FOR EACH ROW
      EXECUTE FUNCTION prevent_duplicate_user_email();
    `);

        // Add composite index for performance and extra safety
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email_tenant ON users (email, tenant_id);
    `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Revert to global email uniqueness
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
      DROP INDEX IF EXISTS idx_users_email_tenant;
    `);
    }
}
