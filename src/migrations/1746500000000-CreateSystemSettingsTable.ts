import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSystemSettingsTable1746500000000
  implements MigrationInterface
{
  name = 'CreateSystemSettingsTable1746500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "system_settings" (
        "key"         VARCHAR(100) NOT NULL,
        "value"       TEXT         NOT NULL,
        "description" TEXT,
        "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "updated_at"  TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_system_settings" PRIMARY KEY ("key")
      )
    `);

    await queryRunner.query(`
      INSERT INTO "system_settings" ("key", "value", "description")
      VALUES ('signup_enabled', 'false', 'When false, the public signup flow is disabled. Users can only join via employee invitations.')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "system_settings"`);
  }
}
