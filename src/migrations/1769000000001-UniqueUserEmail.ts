import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Prevents any NEW duplicate emails, without touching existing data.
 *
 * - Existing duplicate rows remain as-is.
 * - From now on, any INSERT/UPDATE that would cause a duplicate email will fail.
 *
 * Implemented via a PostgreSQL trigger instead of a UNIQUE constraint
 * so that historical duplicates do not break the migration.
 */
export class UniqueUserEmail1769000000001 implements MigrationInterface {
  name = "UniqueUserEmail1769000000001";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create a function that prevents inserting/updating duplicate emails
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_duplicate_user_email()
      RETURNS trigger AS $$
      BEGIN
        -- If email is unchanged on UPDATE, allow it
        IF TG_OP = 'UPDATE' AND NEW.email = OLD.email THEN
          RETURN NEW;
        END IF;

        -- Check if an email already exists (including historical duplicates)
        IF EXISTS (SELECT 1 FROM users WHERE email = NEW.email) THEN
          RAISE EXCEPTION 'Email "%" already exists', NEW.email
            USING ERRCODE = '23505';
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Attach the trigger to users table for INSERT and UPDATE
    await queryRunner.query(`
      CREATE TRIGGER trg_prevent_duplicate_user_email
      BEFORE INSERT OR UPDATE ON users
      FOR EACH ROW
      EXECUTE FUNCTION prevent_duplicate_user_email();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop trigger and function if migration is rolled back
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_prevent_duplicate_user_email ON users;
    `);

    await queryRunner.query(`
      DROP FUNCTION IF EXISTS prevent_duplicate_user_email();
    `);
  }
}


