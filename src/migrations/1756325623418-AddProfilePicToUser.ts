import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProfilePicToUser1756325623418 implements MigrationInterface {
    name = 'AddProfilePicToUser1756325623418'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "teams" DROP CONSTRAINT "FK_9a06e17b915db57b2d9192672a5"`);
        await queryRunner.query(`ALTER TABLE "employees" DROP CONSTRAINT "FK_93a9cbef80993a39415d94b310b"`);
        await queryRunner.query(`ALTER TABLE "users" ADD "profile_pic" character varying(500)`);
        await queryRunner.query(`ALTER TABLE "teams" ALTER COLUMN "created_at" SET DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "teams" ADD CONSTRAINT "FK_9a06e17b915db57b2d9192672a5" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "employees" ADD CONSTRAINT "FK_93a9cbef80993a39415d94b310b" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "employees" DROP CONSTRAINT "FK_93a9cbef80993a39415d94b310b"`);
        await queryRunner.query(`ALTER TABLE "teams" DROP CONSTRAINT "FK_9a06e17b915db57b2d9192672a5"`);
        await queryRunner.query(`ALTER TABLE "teams" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "profile_pic"`);
        await queryRunner.query(`ALTER TABLE "employees" ADD CONSTRAINT "FK_93a9cbef80993a39415d94b310b" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "teams" ADD CONSTRAINT "FK_9a06e17b915db57b2d9192672a5" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
