import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedMobileLoginEnabled1772900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO system_settings (key, value, description)
      VALUES ('mobile_login_enabled', 'true', 'Allow users to log in from the mobile app. Set to false to block all mobile logins.')
      ON CONFLICT (key) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM system_settings WHERE key = 'mobile_login_enabled'
    `);
  }
}
