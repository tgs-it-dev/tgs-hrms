import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAdditionalIndexes1769000000004 implements MigrationInterface {
  name = "AddAdditionalIndexes1769000000004";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Designation indexes
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_designations_tenant_id" ON "designations" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_designations_department_id" ON "designations" ("department_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_designations_tenant_department" ON "designations" ("tenant_id", "department_id")`,
    );

    // Department indexes (additional indexes for better query performance)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_departments_name" ON "departments" ("name")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_departments_tenant_name" ON "departments" ("tenant_id", "name")`,
    );

    // Attendance indexes
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_attendance_user_id" ON "attendance" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_attendance_timestamp" ON "attendance" ("timestamp")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_attendance_user_timestamp" ON "attendance" ("user_id", "timestamp")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_attendance_type" ON "attendance" ("type")`,
    );

    // Team indexes
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_teams_manager_id" ON "teams" ("manager_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes in reverse order
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_teams_manager_id"`);
    
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_attendance_type"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_attendance_user_timestamp"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_attendance_timestamp"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_attendance_user_id"`);
    
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_departments_tenant_name"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_departments_name"`);
    
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_designations_tenant_department"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_designations_department_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_designations_tenant_id"`);
  }
}

