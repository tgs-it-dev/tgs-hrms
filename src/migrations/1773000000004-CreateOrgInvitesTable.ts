import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the `org_invites` table.
 *
 * Design decisions:
 *   - `token`    — 64-char hex (32 cryptographic bytes), unique index for O(1)
 *                  lookup on the accept endpoint.
 *   - `expires_at` — hard expiry enforced at the application layer; no DB job
 *                    needed since the invite is read-only after creation.
 *   - `used_at`  — NULL until accepted; non-NULL triggers HTTP 410 Gone.
 *   - `role`     — references the existing `member_role` PG ENUM created by
 *                  migration 1773000000003 so invalid values are rejected at
 *                  the wire level.
 *   - FK to `tenants` ON DELETE CASCADE — invites disappear with the org.
 *   - FK to `users`   ON DELETE SET NULL — audit trail survives user deletion.
 */
export class CreateOrgInvitesTable1773000000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS org_invites (
        id          UUID          NOT NULL DEFAULT gen_random_uuid(),
        org_id      UUID          NOT NULL,
        email       VARCHAR(255)  NOT NULL,
        role        member_role   NOT NULL,
        token       VARCHAR(64)   NOT NULL,
        expires_at  TIMESTAMPTZ   NOT NULL,
        used_at     TIMESTAMPTZ,
        invited_by  UUID,
        created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),

        CONSTRAINT pk_org_invites          PRIMARY KEY (id),
        CONSTRAINT uq_org_invites_token    UNIQUE      (token),
        CONSTRAINT fk_org_invites_org      FOREIGN KEY (org_id)
          REFERENCES tenants(id) ON DELETE CASCADE,
        CONSTRAINT fk_org_invites_inviter  FOREIGN KEY (invited_by)
          REFERENCES users(id)   ON DELETE SET NULL
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_org_invites_org_id ON org_invites (org_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS org_invites;`);
  }
}
