import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAnnouncementsTable1771400000000 implements MigrationInterface {
  name = 'CreateAnnouncementsTable1771400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create announcements table
    await queryRunner.query(`
      CREATE TABLE "announcements" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "title" varchar(200) NOT NULL,
        "content" text NOT NULL,
        "category" varchar(20) NOT NULL DEFAULT 'general',
        "priority" varchar(10) NOT NULL DEFAULT 'medium',
        "status" varchar(15) NOT NULL DEFAULT 'draft',
        "scheduled_at" TIMESTAMP WITH TIME ZONE,
        "sent_at" TIMESTAMP WITH TIME ZONE,
        "recipient_count" integer NOT NULL DEFAULT 0,
        "created_by" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_announcements" PRIMARY KEY ("id")
      )
    `);

    // Add foreign key to tenants
    await queryRunner.query(`
      ALTER TABLE "announcements"
      ADD CONSTRAINT "FK_announcements_tenant"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE
    `);

    // Add foreign key to users (creator)
    await queryRunner.query(`
      ALTER TABLE "announcements"
      ADD CONSTRAINT "FK_announcements_creator"
      FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    // Create indexes for efficient queries
    await queryRunner.query(`
      CREATE INDEX "IDX_announcements_tenant_status" ON "announcements" ("tenant_id", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_announcements_tenant_category" ON "announcements" ("tenant_id", "category")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_announcements_tenant_scheduled" ON "announcements" ("tenant_id", "scheduled_at")
    `);

    // Add announcement permissions to hr-admin role
    await queryRunner.query(`
      INSERT INTO "permissions" ("name", "description")
      VALUES 
        ('announcement.create', 'Create announcements'),
        ('announcement.read', 'View announcements'),
        ('announcement.update', 'Update announcements'),
        ('announcement.delete', 'Delete announcements'),
        ('announcement.send', 'Send announcement emails')
      ON CONFLICT ("name") DO NOTHING
    `);

    // Link permissions to hr-admin role
    await queryRunner.query(`
      INSERT INTO "role_permissions" ("role_id", "permission_id")
      SELECT r.id, p.id
      FROM "roles" r, "permissions" p
      WHERE r.name = 'hr-admin' AND p.name IN (
        'announcement.create',
        'announcement.read',
        'announcement.update',
        'announcement.delete',
        'announcement.send'
      )
      ON CONFLICT DO NOTHING
    `);

    // Link read permission to manager role
    await queryRunner.query(`
      INSERT INTO "role_permissions" ("role_id", "permission_id")
      SELECT r.id, p.id
      FROM "roles" r, "permissions" p
      WHERE r.name = 'manager' AND p.name = 'announcement.read'
      ON CONFLICT DO NOTHING
    `);

    // Link read permission to employee role
    await queryRunner.query(`
      INSERT INTO "role_permissions" ("role_id", "permission_id")
      SELECT r.id, p.id
      FROM "roles" r, "permissions" p
      WHERE r.name = 'employee' AND p.name = 'announcement.read'
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove role_permissions links
    await queryRunner.query(`
      DELETE FROM "role_permissions"
      WHERE "permission_id" IN (
        SELECT id FROM "permissions" WHERE name LIKE 'announcement.%'
      )
    `);

    // Remove permissions
    await queryRunner.query(`
      DELETE FROM "permissions" WHERE name LIKE 'announcement.%'
    `);

    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_announcements_tenant_scheduled"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_announcements_tenant_category"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_announcements_tenant_status"`);

    // Drop foreign keys
    await queryRunner.query(`ALTER TABLE "announcements" DROP CONSTRAINT IF EXISTS "FK_announcements_creator"`);
    await queryRunner.query(`ALTER TABLE "announcements" DROP CONSTRAINT IF EXISTS "FK_announcements_tenant"`);

    // Drop table
    await queryRunner.query(`DROP TABLE IF EXISTS "announcements"`);
  }
}
