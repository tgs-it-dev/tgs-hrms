import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotificationWorkflowFields1772300000000 implements MigrationInterface {
  name = 'AddNotificationWorkflowFields1772300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE notifications
        ADD COLUMN IF NOT EXISTS sender_id uuid NULL,
        ADD COLUMN IF NOT EXISTS sender_role varchar(32) NULL,
        ADD COLUMN IF NOT EXISTS action varchar(20) NULL,
        ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;
    `);
    try {
      await queryRunner.query(`
        ALTER TABLE notifications
          ADD CONSTRAINT fk_notifications_sender_id
          FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL;
      `);
    } catch {
      // Constraint may already exist from a previous run
    }
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_notifications_tenant_user ON notifications(tenant_id, user_id);`,
    );
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_notifications_action ON notifications(action);`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_notifications_related_entity ON notifications(related_entity_type, related_entity_id);`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_notifications_related_entity;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_notifications_action;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_notifications_tenant_user;`);
    await queryRunner.query(`ALTER TABLE notifications DROP CONSTRAINT IF EXISTS fk_notifications_sender_id;`);
    await queryRunner.query(`
      ALTER TABLE notifications
        DROP COLUMN IF EXISTS is_system,
        DROP COLUMN IF EXISTS action,
        DROP COLUMN IF EXISTS sender_role,
        DROP COLUMN IF EXISTS sender_id;
    `);
  }
}
