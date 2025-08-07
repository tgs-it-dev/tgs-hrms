import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTokensToUser1754428795661 implements MigrationInterface {
    name = 'AddTokensToUser1754428795661'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "refresh_token" text`);
        await queryRunner.query(`ALTER TABLE "users" ADD "reset_token" text`);
        await queryRunner.query(`ALTER TABLE "users" ADD "reset_token_expiry" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "reset_token_expiry"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "reset_token"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "refresh_token"`);
    }

}
