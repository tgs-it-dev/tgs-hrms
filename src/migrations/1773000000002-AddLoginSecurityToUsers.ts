import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLoginSecurityToUsers1773000000002
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE public.users
        ADD COLUMN IF NOT EXISTS failed_login_attempts INT         NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS locked_until          TIMESTAMPTZ          DEFAULT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE public.users
        DROP COLUMN IF EXISTS failed_login_attempts,
        DROP COLUMN IF EXISTS locked_until
    `);
  }
}
