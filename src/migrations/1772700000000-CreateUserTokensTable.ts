import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUserTokensTable1772700000000 implements MigrationInterface {
  name = "CreateUserTokensTable1772700000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "user_tokens" (
        "id"          UUID        NOT NULL,
        "user_id"     UUID        NOT NULL,
        "platform"    VARCHAR(20),
        "device_info" TEXT,
        "ip_address"  VARCHAR(45),
        "expires_at"  TIMESTAMPTZ NOT NULL,
        "last_used_at" TIMESTAMPTZ,
        "is_revoked"  BOOLEAN     NOT NULL DEFAULT false,
        "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_tokens_user_id"
          FOREIGN KEY ("user_id")
          REFERENCES "users"("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_user_tokens_user_revoked"
        ON "user_tokens" ("user_id", "is_revoked")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_user_tokens_expires_at"
        ON "user_tokens" ("expires_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_user_tokens_expires_at"`);
    await queryRunner.query(`DROP INDEX "IDX_user_tokens_user_revoked"`);
    await queryRunner.query(`DROP TABLE "user_tokens"`);
  }
}
