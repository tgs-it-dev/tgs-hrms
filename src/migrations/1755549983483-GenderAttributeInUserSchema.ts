import { MigrationInterface, QueryRunner } from "typeorm";

export class GenderAttributeInUserSchema1755549983483 implements MigrationInterface {
    name = 'GenderAttributeInUserSchema1755549983483'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "gender" character varying(10)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "gender"`);
    }

}
