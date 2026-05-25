import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Removes the system-wide mobile_login_enabled key from system_settings.
 * This setting was superseded by the per-tenant tenant_settings table.
 * Nothing reads this key anymore; leaving it causes confusion in the
 * system-settings admin view.
 */
export class CleanupMobileLoginEnabledFromSystemSettings1773200000003
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM system_settings WHERE key = 'mobile_login_enabled'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO system_settings (key, value, description)
      VALUES (
        'mobile_login_enabled',
        'true',
        'Allow users to log in from the mobile app. Set to false to block all mobile logins.'
      )
      ON CONFLICT (key) DO NOTHING
    `);
  }
}
