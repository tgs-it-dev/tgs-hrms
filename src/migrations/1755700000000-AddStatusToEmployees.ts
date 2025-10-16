import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStatusToEmployees1755700000000 implements MigrationInterface {
    name = 'AddStatusToEmployees1755700000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "employees" ADD "status" character varying(20) NOT NULL DEFAULT 'active'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "employees" DROP COLUMN "status"`);
    }
}


