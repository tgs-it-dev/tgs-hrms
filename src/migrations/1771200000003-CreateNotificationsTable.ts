import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotificationsTable1771200000003 implements MigrationInterface {
  name = 'CreateNotificationsTable1771200000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL,
        tenant_id uuid NOT NULL,
        message text NOT NULL,
        type varchar(20) NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'unread',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_notifications_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_notifications_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_notifications_tenant_id ON notifications(tenant_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user_status ON notifications(user_id, status);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS notifications;`);
  }
}
