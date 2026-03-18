import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotificationRelatedEntityFields1771300000000 implements MigrationInterface {
  name = 'AddNotificationRelatedEntityFields1771300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE notifications
        ADD COLUMN IF NOT EXISTS related_entity_type varchar(32) NULL,
        ADD COLUMN IF NOT EXISTS related_entity_id uuid NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE notifications
        DROP COLUMN IF EXISTS related_entity_id,
        DROP COLUMN IF EXISTS related_entity_type;
    `);
  }
}
