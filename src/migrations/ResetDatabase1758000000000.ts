import { MigrationInterface, QueryRunner } from "typeorm";
export class ResetDatabase1758000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Disable triggers (foreign key checks)
        await queryRunner.query(`SET session_replication_role = 'replica';`);
        // Truncate all tables (order matters due to FKs)
        await queryRunner.query(`TRUNCATE TABLE
            "attendance",
            "leaves",
            "timesheets",
            "employees",
            "users",
            "teams",
            "designations",
            "departments",
            "policies",
            "tenants"
        RESTART IDENTITY CASCADE;`);
        // Re-enable triggers
        await queryRunner.query(`SET session_replication_role = 'origin';`);
    }
    public async down(queryRunner: QueryRunner): Promise<void> {
        // No rollback for data deletion
    }
}