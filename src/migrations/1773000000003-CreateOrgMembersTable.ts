import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the `member_role` PostgreSQL ENUM type and the `org_members` table.
 *
 * Using a named CREATE TYPE (rather than relying on TypeORM's inline CHECK
 * constraint) means PostgreSQL rejects invalid role values at the wire level —
 * not just in application code.
 *
 * Uniqueness: one membership row per (org_id, user_id) pair.
 */
export class CreateOrgMembersTable1773000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create the named PostgreSQL ENUM type.
    //    IF NOT EXISTS guard makes the migration re-runnable in CI.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'member_role'
        ) THEN
          CREATE TYPE member_role AS ENUM ('owner', 'admin', 'member');
        END IF;
      END
      $$;
    `);

    // 2. Create the org_members table referencing the named ENUM.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS org_members (
        id         UUID        NOT NULL DEFAULT gen_random_uuid(),
        org_id     UUID        NOT NULL,
        user_id    UUID        NOT NULL,
        member_role member_role NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

        CONSTRAINT pk_org_members          PRIMARY KEY (id),
        CONSTRAINT uq_org_members_org_user UNIQUE      (org_id, user_id),
        CONSTRAINT fk_org_members_org      FOREIGN KEY (org_id)
          REFERENCES tenants(id) ON DELETE CASCADE,
        CONSTRAINT fk_org_members_user     FOREIGN KEY (user_id)
          REFERENCES users(id)   ON DELETE CASCADE
      );
    `);

    // 3. Indexes for the most common lookup patterns.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_org_members_org_id  ON org_members (org_id);
      CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON org_members (user_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS org_members;`);
    await queryRunner.query(`DROP TYPE IF EXISTS member_role;`);
  }
}
