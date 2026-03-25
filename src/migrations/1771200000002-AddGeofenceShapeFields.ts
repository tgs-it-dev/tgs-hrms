import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGeofenceShapeFields1771200000002 implements MigrationInterface {
  name = 'AddGeofenceShapeFields1771200000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE geofences
        ADD COLUMN IF NOT EXISTS type varchar(32) NULL,
        ADD COLUMN IF NOT EXISTS radius numeric NULL,
        ADD COLUMN IF NOT EXISTS coordinates jsonb NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE geofences
        DROP COLUMN IF EXISTS coordinates,
        DROP COLUMN IF EXISTS radius,
        DROP COLUMN IF EXISTS type;
    `);
  }
}

