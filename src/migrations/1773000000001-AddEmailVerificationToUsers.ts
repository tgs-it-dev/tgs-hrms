import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailVerificationToUsers1773000000001
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE public.users
        ADD COLUMN IF NOT EXISTS email_verified             BOOLEAN     NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS email_verification_token   TEXT                 DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMPTZ      DEFAULT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE public.users
        DROP COLUMN IF EXISTS email_verified,
        DROP COLUMN IF EXISTS email_verification_token,
        DROP COLUMN IF EXISTS email_verification_expires_at
    `);
  }
}
