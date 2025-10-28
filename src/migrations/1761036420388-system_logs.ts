import { MigrationInterface, QueryRunner } from "typeorm";

export class SystemLogs1761036420388 implements MigrationInterface {
  name = "SystemLogs1761036420388";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "system_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "action" character varying(100), "entityType" character varying(100), "userId" uuid, "userRole" character varying(50), "tenantId" uuid, "route" character varying(255), "method" character varying(10), "ip" character varying(50), "meta" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_56861c4b9d16aa90259f4ce0a2c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f4f5248b93c3ca62ed3761b30f" ON "system_logs" ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_10f795adf8e1fc6c750a710135" ON "system_logs" ("tenantId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2603d9fdfe248b9cb5d0acc4c3" ON "system_logs" ("userId", "action") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f819ef806b1ee3ce9089fe5b90" ON "system_logs" ("tenantId", "created_at") `,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD "status" character varying NOT NULL DEFAULT 'active'`,
    );
    await queryRunner.query(
      `ALTER TABLE "leaves" ADD CONSTRAINT "FK_76c3f8b49993d46343703697012" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "leaves" DROP CONSTRAINT "FK_76c3f8b49993d46343703697012"`,
    );
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN "status"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f819ef806b1ee3ce9089fe5b90"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2603d9fdfe248b9cb5d0acc4c3"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_10f795adf8e1fc6c750a710135"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f4f5248b93c3ca62ed3761b30f"`,
    );
    await queryRunner.query(`DROP TABLE "system_logs"`);
  }
}
