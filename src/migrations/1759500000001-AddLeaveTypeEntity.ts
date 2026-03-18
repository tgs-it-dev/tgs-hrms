import { MigrationInterface, QueryRunner } from "typeorm";
import { v4 as uuidv4 } from "uuid";

export class AddLeaveTypeEntity1759500000001 implements MigrationInterface {
  name = 'AddLeaveTypeEntity1759500000001'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create leave_types table
    await queryRunner.query(`
      CREATE TABLE "leave_types" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(255) NOT NULL,
        "description" text,
        "maxDaysPerYear" integer NOT NULL DEFAULT '0',
        "carryForward" boolean NOT NULL DEFAULT false,
        "tenantId" uuid NOT NULL,
        "createdBy" uuid NOT NULL,
        "status" character varying(50) NOT NULL DEFAULT 'active',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_leave_types" PRIMARY KEY ("id")
      )
    `);

    // Add foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "leave_types" 
      ADD CONSTRAINT "FK_leave_types_tenant" 
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "leave_types" 
      ADD CONSTRAINT "FK_leave_types_creator" 
      FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX "IDX_leave_types_tenant" ON "leave_types" ("tenantId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_leave_types_status" ON "leave_types" ("status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "leave_types"`);
  }
}
