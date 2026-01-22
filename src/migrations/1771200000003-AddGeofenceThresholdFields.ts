import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGeofenceThresholdFields1771200000003 implements MigrationInterface {
  name = 'AddGeofenceThresholdFields1771200000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE geofences
        ADD COLUMN IF NOT EXISTS threshold_distance numeric NULL,
        ADD COLUMN IF NOT EXISTS threshold_enabled boolean NOT NULL DEFAULT false;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE geofences
        DROP COLUMN IF EXISTS threshold_enabled,
        DROP COLUMN IF EXISTS threshold_distance;
    `);
  }
}
