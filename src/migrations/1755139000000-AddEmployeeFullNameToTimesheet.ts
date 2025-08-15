import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEmployeeFullNameToTimesheet1755139000000 implements MigrationInterface {
    name = 'AddEmployeeFullNameToTimesheet1755139000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "timesheets" ADD "employee_full_name" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "timesheets" DROP COLUMN "employee_full_name"`);
    }
}


