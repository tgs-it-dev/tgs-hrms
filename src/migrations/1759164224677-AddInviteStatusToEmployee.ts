import { MigrationInterface, QueryRunner } from "typeorm";
export class AddInviteStatusToEmployee1759164224677 implements MigrationInterface {
    name = 'AddInviteStatusToEmployee1759164224677'
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add column with default
        await queryRunner.query(`ALTER TABLE "employees" ADD "invite_status" character varying(20) NOT NULL DEFAULT 'Invite Sent'`);
        // Backfill any nulls just in case
        await queryRunner.query(`UPDATE "employees" SET "invite_status" = 'Invite Sent' WHERE "invite_status" IS NULL`);
    }
    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "employees" DROP COLUMN "invite_status"`);
    }
}
