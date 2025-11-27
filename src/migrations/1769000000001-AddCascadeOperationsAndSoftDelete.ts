import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCascadeOperationsAndSoftDelete1769000000001 implements MigrationInterface {
  name = "AddCascadeOperationsAndSoftDelete1769000000001";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================
    // USER ENTITY RELATIONSHIPS
    // ============================================
    
    // User -> Tenant: RESTRICT (prevent hard delete)
    await queryRunner.query(`
      DO $$
      DECLARE
        constraint_name_var TEXT;
      BEGIN
        SELECT tc.constraint_name INTO constraint_name_var
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'users' 
          AND kcu.column_name = 'tenant_id'
          AND tc.constraint_type = 'FOREIGN KEY'
        LIMIT 1;
        
        IF constraint_name_var IS NOT NULL THEN
          EXECUTE format('ALTER TABLE "users" DROP CONSTRAINT IF EXISTS %I', constraint_name_var);
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "users" 
      ADD CONSTRAINT "FK_users_tenant" 
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") 
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);

    // User -> Role: RESTRICT (prevent deletion if users exist)
    await queryRunner.query(`
      DO $$
      DECLARE
        constraint_name_var TEXT;
      BEGIN
        SELECT tc.constraint_name INTO constraint_name_var
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'users' 
          AND kcu.column_name = 'role_id'
          AND tc.constraint_type = 'FOREIGN KEY'
        LIMIT 1;
        
        IF constraint_name_var IS NOT NULL THEN
          EXECUTE format('ALTER TABLE "users" DROP CONSTRAINT IF EXISTS %I', constraint_name_var);
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "users" 
      ADD CONSTRAINT "FK_users_role" 
      FOREIGN KEY ("role_id") REFERENCES "roles"("id") 
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);

    // ============================================
    // DEPARTMENT ENTITY RELATIONSHIPS
    // ============================================
    
    // Department -> Tenant: RESTRICT
    await queryRunner.query(`
      DO $$
      DECLARE
        constraint_name_var TEXT;
      BEGIN
        SELECT tc.constraint_name INTO constraint_name_var
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'departments' 
          AND kcu.column_name = 'tenant_id'
          AND tc.constraint_type = 'FOREIGN KEY'
        LIMIT 1;
        
        IF constraint_name_var IS NOT NULL THEN
          EXECUTE format('ALTER TABLE "departments" DROP CONSTRAINT IF EXISTS %I', constraint_name_var);
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "departments" 
      ADD CONSTRAINT "FK_departments_tenant" 
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") 
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);

    // ============================================
    // DESIGNATION ENTITY RELATIONSHIPS
    // ============================================
    
    // Designation -> Department: CASCADE
    await queryRunner.query(`
      DO $$
      DECLARE
        constraint_name_var TEXT;
      BEGIN
        SELECT tc.constraint_name INTO constraint_name_var
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'designations' 
          AND kcu.column_name = 'department_id'
          AND tc.constraint_type = 'FOREIGN KEY'
        LIMIT 1;
        
        IF constraint_name_var IS NOT NULL THEN
          EXECUTE format('ALTER TABLE "designations" DROP CONSTRAINT IF EXISTS %I', constraint_name_var);
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "designations" 
      ADD CONSTRAINT "FK_designations_department" 
      FOREIGN KEY ("department_id") REFERENCES "departments"("id") 
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    // ============================================
    // EMPLOYEE ENTITY RELATIONSHIPS
    // ============================================
    
    // Employee -> User: CASCADE
    await queryRunner.query(`
      DO $$
      DECLARE
        constraint_name_var TEXT;
      BEGIN
        SELECT tc.constraint_name INTO constraint_name_var
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'employees' 
          AND kcu.column_name = 'user_id'
          AND tc.constraint_type = 'FOREIGN KEY'
        LIMIT 1;
        
        IF constraint_name_var IS NOT NULL THEN
          EXECUTE format('ALTER TABLE "employees" DROP CONSTRAINT IF EXISTS %I', constraint_name_var);
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "employees" 
      ADD CONSTRAINT "FK_employees_user" 
      FOREIGN KEY ("user_id") REFERENCES "users"("id") 
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    // Employee -> Designation: RESTRICT
    await queryRunner.query(`
      DO $$
      DECLARE
        constraint_name_var TEXT;
      BEGIN
        SELECT tc.constraint_name INTO constraint_name_var
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'employees' 
          AND kcu.column_name = 'designation_id'
          AND tc.constraint_type = 'FOREIGN KEY'
        LIMIT 1;
        
        IF constraint_name_var IS NOT NULL THEN
          EXECUTE format('ALTER TABLE "employees" DROP CONSTRAINT IF EXISTS %I', constraint_name_var);
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "employees" 
      ADD CONSTRAINT "FK_employees_designation" 
      FOREIGN KEY ("designation_id") REFERENCES "designations"("id") 
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);

    // Employee -> Team: SET NULL
    await queryRunner.query(`
      DO $$
      DECLARE
        constraint_name_var TEXT;
      BEGIN
        SELECT tc.constraint_name INTO constraint_name_var
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'employees' 
          AND kcu.column_name = 'team_id'
          AND tc.constraint_type = 'FOREIGN KEY'
        LIMIT 1;
        
        IF constraint_name_var IS NOT NULL THEN
          EXECUTE format('ALTER TABLE "employees" DROP CONSTRAINT IF EXISTS %I', constraint_name_var);
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "employees" 
      ADD CONSTRAINT "FK_employees_team" 
      FOREIGN KEY ("team_id") REFERENCES "teams"("id") 
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    // ============================================
    // EMPLOYEE BENEFIT ENTITY RELATIONSHIPS
    // ============================================
    
    // EmployeeBenefit -> Employee: CASCADE
    await queryRunner.query(`
      DO $$
      DECLARE
        constraint_name_var TEXT;
      BEGIN
        SELECT tc.constraint_name INTO constraint_name_var
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'employee_benefits' 
          AND kcu.column_name = 'employee_id'
          AND tc.constraint_type = 'FOREIGN KEY'
        LIMIT 1;
        
        IF constraint_name_var IS NOT NULL THEN
          EXECUTE format('ALTER TABLE "employee_benefits" DROP CONSTRAINT IF EXISTS %I', constraint_name_var);
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "employee_benefits" 
      ADD CONSTRAINT "FK_employee_benefits_employee" 
      FOREIGN KEY ("employee_id") REFERENCES "employees"("id") 
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    // EmployeeBenefit -> Tenant: RESTRICT
    await queryRunner.query(`
      DO $$
      DECLARE
        constraint_name_var TEXT;
      BEGIN
        SELECT tc.constraint_name INTO constraint_name_var
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'employee_benefits' 
          AND kcu.column_name = 'tenant_id'
          AND tc.constraint_type = 'FOREIGN KEY'
        LIMIT 1;
        
        IF constraint_name_var IS NOT NULL THEN
          EXECUTE format('ALTER TABLE "employee_benefits" DROP CONSTRAINT IF EXISTS %I', constraint_name_var);
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "employee_benefits" 
      ADD CONSTRAINT "FK_employee_benefits_tenant" 
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") 
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);

    // ============================================
    // EMPLOYEE KPI ENTITY RELATIONSHIPS
    // ============================================
    
    // EmployeeKpi -> Employee: CASCADE
    await queryRunner.query(`
      DO $$
      DECLARE
        constraint_name_var TEXT;
      BEGIN
        SELECT tc.constraint_name INTO constraint_name_var
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'employee-kpis' 
          AND kcu.column_name = 'employee_id'
          AND tc.constraint_type = 'FOREIGN KEY'
        LIMIT 1;
        
        IF constraint_name_var IS NOT NULL THEN
          EXECUTE format('ALTER TABLE "employee-kpis" DROP CONSTRAINT IF EXISTS %I', constraint_name_var);
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "employee-kpis" 
      ADD CONSTRAINT "FK_employee_kpis_employee" 
      FOREIGN KEY ("employee_id") REFERENCES "employees"("id") 
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    // EmployeeKpi -> Tenant: RESTRICT
    await queryRunner.query(`
      DO $$
      DECLARE
        constraint_name_var TEXT;
      BEGIN
        SELECT tc.constraint_name INTO constraint_name_var
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'employee-kpis' 
          AND kcu.column_name = 'tenant_id'
          AND tc.constraint_type = 'FOREIGN KEY'
        LIMIT 1;
        
        IF constraint_name_var IS NOT NULL THEN
          EXECUTE format('ALTER TABLE "employee-kpis" DROP CONSTRAINT IF EXISTS %I', constraint_name_var);
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "employee-kpis" 
      ADD CONSTRAINT "FK_employee_kpis_tenant" 
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") 
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);

    // ============================================
    // BENEFIT ENTITY RELATIONSHIPS
    // ============================================
    
    // Benefit -> Tenant: RESTRICT
    await queryRunner.query(`
      DO $$
      DECLARE
        constraint_name_var TEXT;
      BEGIN
        SELECT tc.constraint_name INTO constraint_name_var
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'benefits' 
          AND kcu.column_name = 'tenant_id'
          AND tc.constraint_type = 'FOREIGN KEY'
        LIMIT 1;
        
        IF constraint_name_var IS NOT NULL THEN
          EXECUTE format('ALTER TABLE "benefits" DROP CONSTRAINT IF EXISTS %I', constraint_name_var);
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "benefits" 
      ADD CONSTRAINT "FK_benefits_tenant" 
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") 
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);

    // ============================================
    // LEAVE ENTITY RELATIONSHIPS
    // ============================================
    
    // Leave -> Tenant: RESTRICT
    await queryRunner.query(`
      DO $$
      DECLARE
        constraint_name_var TEXT;
      BEGIN
        SELECT tc.constraint_name INTO constraint_name_var
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'leaves' 
          AND kcu.column_name = 'tenantId'
          AND tc.constraint_type = 'FOREIGN KEY'
        LIMIT 1;
        
        IF constraint_name_var IS NOT NULL THEN
          EXECUTE format('ALTER TABLE "leaves" DROP CONSTRAINT IF EXISTS %I', constraint_name_var);
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "leaves" 
      ADD CONSTRAINT "FK_leaves_tenant" 
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") 
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert Leave -> Tenant
    await queryRunner.query(`
      ALTER TABLE "leaves" DROP CONSTRAINT IF EXISTS "FK_leaves_tenant"
    `);
    await queryRunner.query(`
      ALTER TABLE "leaves" 
      ADD CONSTRAINT "FK_leaves_tenant" 
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") 
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // Revert Benefit -> Tenant
    await queryRunner.query(`
      ALTER TABLE "benefits" DROP CONSTRAINT IF EXISTS "FK_benefits_tenant"
    `);
    await queryRunner.query(`
      ALTER TABLE "benefits" 
      ADD CONSTRAINT "FK_benefits_tenant" 
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") 
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // Revert EmployeeKpi -> Tenant
    await queryRunner.query(`
      ALTER TABLE "employee-kpis" DROP CONSTRAINT IF EXISTS "FK_employee_kpis_tenant"
    `);
    await queryRunner.query(`
      ALTER TABLE "employee-kpis" 
      ADD CONSTRAINT "FK_employee_kpis_tenant" 
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") 
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // Revert EmployeeKpi -> Employee
    await queryRunner.query(`
      ALTER TABLE "employee-kpis" DROP CONSTRAINT IF EXISTS "FK_employee_kpis_employee"
    `);
    await queryRunner.query(`
      ALTER TABLE "employee-kpis" 
      ADD CONSTRAINT "FK_employee_kpis_employee" 
      FOREIGN KEY ("employee_id") REFERENCES "employees"("id") 
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // Revert EmployeeBenefit -> Tenant
    await queryRunner.query(`
      ALTER TABLE "employee_benefits" DROP CONSTRAINT IF EXISTS "FK_employee_benefits_tenant"
    `);
    await queryRunner.query(`
      ALTER TABLE "employee_benefits" 
      ADD CONSTRAINT "FK_employee_benefits_tenant" 
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") 
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // Revert EmployeeBenefit -> Employee
    await queryRunner.query(`
      ALTER TABLE "employee_benefits" DROP CONSTRAINT IF EXISTS "FK_employee_benefits_employee"
    `);
    await queryRunner.query(`
      ALTER TABLE "employee_benefits" 
      ADD CONSTRAINT "FK_employee_benefits_employee" 
      FOREIGN KEY ("employee_id") REFERENCES "employees"("id") 
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // Revert Employee -> Team
    await queryRunner.query(`
      ALTER TABLE "employees" DROP CONSTRAINT IF EXISTS "FK_employees_team"
    `);
    await queryRunner.query(`
      ALTER TABLE "employees" 
      ADD CONSTRAINT "FK_employees_team" 
      FOREIGN KEY ("team_id") REFERENCES "teams"("id") 
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // Revert Employee -> Designation
    await queryRunner.query(`
      ALTER TABLE "employees" DROP CONSTRAINT IF EXISTS "FK_employees_designation"
    `);
    await queryRunner.query(`
      ALTER TABLE "employees" 
      ADD CONSTRAINT "FK_employees_designation" 
      FOREIGN KEY ("designation_id") REFERENCES "designations"("id") 
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // Revert Employee -> User
    await queryRunner.query(`
      ALTER TABLE "employees" DROP CONSTRAINT IF EXISTS "FK_employees_user"
    `);
    await queryRunner.query(`
      ALTER TABLE "employees" 
      ADD CONSTRAINT "FK_employees_user" 
      FOREIGN KEY ("user_id") REFERENCES "users"("id") 
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // Revert Designation -> Department
    await queryRunner.query(`
      ALTER TABLE "designations" DROP CONSTRAINT IF EXISTS "FK_designations_department"
    `);
    await queryRunner.query(`
      ALTER TABLE "designations" 
      ADD CONSTRAINT "FK_designations_department" 
      FOREIGN KEY ("department_id") REFERENCES "departments"("id") 
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // Revert Department -> Tenant
    await queryRunner.query(`
      ALTER TABLE "departments" DROP CONSTRAINT IF EXISTS "FK_departments_tenant"
    `);
    await queryRunner.query(`
      ALTER TABLE "departments" 
      ADD CONSTRAINT "FK_departments_tenant" 
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") 
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // Revert User -> Role
    await queryRunner.query(`
      ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "FK_users_role"
    `);
    await queryRunner.query(`
      ALTER TABLE "users" 
      ADD CONSTRAINT "FK_users_role" 
      FOREIGN KEY ("role_id") REFERENCES "roles"("id") 
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // Revert User -> Tenant
    await queryRunner.query(`
      ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "FK_users_tenant"
    `);
    await queryRunner.query(`
      ALTER TABLE "users" 
      ADD CONSTRAINT "FK_users_tenant" 
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") 
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
  }
}

