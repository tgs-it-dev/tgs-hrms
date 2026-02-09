import { MigrationInterface, QueryRunner } from "typeorm";

export class DropEmployeeProfilePicture1770655000000 implements MigrationInterface {
    name = 'DropEmployeeProfilePicture1770655000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // First check if column exists to avoid errors
        const hasColumn = await queryRunner.hasColumn("employees", "profile_picture");
        if (hasColumn) {
            await queryRunner.query(`ALTER TABLE "employees" DROP COLUMN "profile_picture"`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "employees" ADD "profile_picture" character varying(500)`);
    }

}
