import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEmailToEmployee1752000000000 implements MigrationInterface {
    name = 'AddEmailToEmployee1752000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add email column to employee table
        await queryRunner.query(`ALTER TABLE "employee" ADD "email" character varying(255) NOT NULL`);
        
        // Add unique constraint for email
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_employee_email_unique" ON "employee" ("email")`);
        
        // Add unique constraint for email within tenant (optional - for multi-tenant email uniqueness)
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_employee_email_tenant_unique" ON "employee" ("email", "tenantId")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove unique constraints
        await queryRunner.query(`DROP INDEX "public"."IDX_employee_email_tenant_unique"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_employee_email_unique"`);
        
        // Remove email column
        await queryRunner.query(`ALTER TABLE "employee" DROP COLUMN "email"`);
    }
} 