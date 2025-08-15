import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDurationHoursToTimesheet1755138336878 implements MigrationInterface {
    name = 'AddDurationHoursToTimesheet1755138336878'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "timesheets" ADD "duration_hours" double precision`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "timesheets" DROP COLUMN "duration_hours"`);
    }

}
