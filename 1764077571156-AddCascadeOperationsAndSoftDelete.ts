import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration: AddCascadeOperationsAndSoftDelete
 * 
 * This migration adds CASCADE operations to entity relationships.
 * 
 * IMPORTANT: Soft delete is already implemented for tenants:
 * - isDeleted column exists (from migration 1761048855939-tenant_deleted.ts)
 * - deleted_at column exists (from migration 1761048855939-tenant_deleted.ts)
 * - Tenant deletion uses soft delete (sets isDeleted=true, deleted_at=now(), status='suspended')
 * - Employee data is preserved for import info
 * - Employees cannot login when tenant is deleted (checked in auth.service.ts)
 * 
 * This migration only handles CASCADE operations for foreign key constraints.
 */
export class AddCascadeOperationsAndSoftDelete1764077571156 implements MigrationInterface {
    name = 'AddCascadeOperationsAndSoftDelete1764077571156'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // ============================================
        // CASCADE OPERATIONS FOR ENTITY RELATIONSHIPS
        // Note: Soft delete for tenants is already implemented in tenant.service.ts
        // ============================================
        await queryRunner.query(`ALTER TABLE "benefits" DROP CONSTRAINT "FK_ac38f8fbe45fb10e281d2e3f3f4"`);
        await queryRunner.query(`ALTER TABLE "employee_benefits" DROP CONSTRAINT "FK_fde882fa7799392110d25c80174"`);
        await queryRunner.query(`ALTER TABLE "employee_benefits" DROP CONSTRAINT "FK_6f762f96c97f977adf0892b2820"`);
        await queryRunner.query(`ALTER TABLE "employee-kpis" DROP CONSTRAINT "FK_cada35504ffffc1acb93e75a806"`);
        await queryRunner.query(`ALTER TABLE "employee-kpis" DROP CONSTRAINT "FK_b2608bbd7875ed322d09c9c529d"`);
        await queryRunner.query(`ALTER TABLE "employees" DROP CONSTRAINT "FK_93a9cbef80993a39415d94b310b"`);
        await queryRunner.query(`ALTER TABLE "employees" DROP CONSTRAINT "FK_2de5d6e4fb3345f18bc467017f0"`);
        await queryRunner.query(`ALTER TABLE "employees" DROP CONSTRAINT "FK_2d83c53c3e553a48dadb9722e38"`);
        await queryRunner.query(`ALTER TABLE "designations" DROP CONSTRAINT "FK_97884615dba807341722aa7aa4b"`);
        await queryRunner.query(`ALTER TABLE "departments" DROP CONSTRAINT "FK_146fd7019eea73f8ee7bbb52d4a"`);
        await queryRunner.query(`ALTER TABLE "asset_subcategories" DROP CONSTRAINT "FK_subcategories_category"`);
        await queryRunner.query(`ALTER TABLE "asset_subcategories" DROP CONSTRAINT "FK_asset_subcategories_tenant"`);
        await queryRunner.query(`ALTER TABLE "asset_categories" DROP CONSTRAINT "FK_asset_categories_tenant"`);
        await queryRunner.query(`ALTER TABLE "assets" DROP CONSTRAINT "FK_assets_category"`);
        await queryRunner.query(`ALTER TABLE "assets" DROP CONSTRAINT "FK_assets_subcategory"`);
        await queryRunner.query(`ALTER TABLE "leave_types" DROP CONSTRAINT "FK_leave_types_creator"`);
        await queryRunner.query(`ALTER TABLE "leave_types" DROP CONSTRAINT "FK_leave_types_tenant"`);
        await queryRunner.query(`ALTER TABLE "leaves" DROP CONSTRAINT "FK_76c3f8b49993d46343703697012"`);
        await queryRunner.query(`ALTER TABLE "leaves" DROP CONSTRAINT "FK_leaves_tenant"`);
        await queryRunner.query(`ALTER TABLE "leaves" DROP CONSTRAINT "FK_leaves_approver"`);
        await queryRunner.query(`ALTER TABLE "leaves" DROP CONSTRAINT "FK_leaves_leaveType"`);
        await queryRunner.query(`ALTER TABLE "leaves" DROP CONSTRAINT "FK_leaves_employee"`);
        await queryRunner.query(`ALTER TABLE "leaves" DROP CONSTRAINT "FK_80500bfd86d628c5e9fdcb49fac"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_109638590074998bb72a2f2cf08"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_a2cecd1a3531c0b041e29ba46e1"`);
        await queryRunner.query(`ALTER TABLE "payroll_records" DROP CONSTRAINT "FK_payroll_records_approved_by"`);
        await queryRunner.query(`ALTER TABLE "payroll_records" DROP CONSTRAINT "FK_payroll_records_generated_by"`);
        await queryRunner.query(`ALTER TABLE "payroll_records" DROP CONSTRAINT "FK_payroll_records_employee_id"`);
        await queryRunner.query(`ALTER TABLE "payroll_records" DROP CONSTRAINT "FK_payroll_records_tenant_id"`);
        await queryRunner.query(`ALTER TABLE "payroll_configs" DROP CONSTRAINT "FK_payroll_configs_tenant_id"`);
        await queryRunner.query(`ALTER TABLE "employee_salaries" DROP CONSTRAINT "FK_employee_salaries_employee_id"`);
        await queryRunner.query(`ALTER TABLE "employee_salaries" DROP CONSTRAINT "FK_employee_salaries_tenant_id"`);
        await queryRunner.query(`ALTER TABLE "asset_requests" DROP CONSTRAINT "FK_asset_requests_category"`);
        await queryRunner.query(`ALTER TABLE "asset_requests" DROP CONSTRAINT "FK_asset_requests_subcategory"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_asset_subcategories_tenant"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_asset_subcategories_unique"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_asset_categories_tenant"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_asset_categories_unique"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_assets_subcategory"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_leave_types_tenant"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_leave_types_status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_leaves_employee"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_leaves_leaveType"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_leaves_tenant"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_leaves_status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_payroll_records_tenant_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_payroll_records_employee_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_payroll_records_month_year"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_payroll_configs_tenant_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_employee_salaries_tenant_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_employee_salaries_employee_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_asset_requests_subcategory"`);
        await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN "description"`);
        await queryRunner.query(`ALTER TABLE "asset_subcategories" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "asset_subcategories" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "asset_categories" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "asset_categories" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "leaves" ALTER COLUMN "leaveTypeId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "leaves" ALTER COLUMN "totalDays" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "leaves" ALTER COLUMN "tenantId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN "name"`);
        await queryRunner.query(`ALTER TABLE "tenants" ADD "name" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "tenants" ALTER COLUMN "created_at" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "tenants" ALTER COLUMN "updated_at" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "payroll_records" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "payroll_records" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "payroll_records" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "payroll_records" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "payroll_records" DROP COLUMN "deleted_at"`);
        await queryRunner.query(`ALTER TABLE "payroll_records" ADD "deleted_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "payroll_configs" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "payroll_configs" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "payroll_configs" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "payroll_configs" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "payroll_configs" DROP COLUMN "deleted_at"`);
        await queryRunner.query(`ALTER TABLE "payroll_configs" ADD "deleted_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "employee_salaries" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "employee_salaries" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "employee_salaries" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "employee_salaries" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "employee_salaries" DROP COLUMN "deleted_at"`);
        await queryRunner.query(`ALTER TABLE "employee_salaries" ADD "deleted_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`CREATE INDEX "IDX_d4278e2dd5d9673eac18b6ab6f" ON "leaves" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_58160dba748dd2fc3544977e9a" ON "leaves" ("leaveTypeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_8cf18b9a419a38a23e31c4ce30" ON "leaves" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_76c3f8b49993d4634370369701" ON "leaves" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b16b8357ebd5570e91c48299ab" ON "payroll_records" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_ecf7648dbd87669698c31222ca" ON "payroll_records" ("employee_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_fe4052e005112ea36363ae926c" ON "payroll_records" ("month") `);
        await queryRunner.query(`CREATE INDEX "IDX_62bceba317b975fe7781980a25" ON "payroll_records" ("year") `);
        await queryRunner.query(`CREATE INDEX "IDX_c2556e7b58d29a01a38af79faf" ON "employee_salaries" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_5cee264c9d34d5836769435cb0" ON "employee_salaries" ("employee_id") `);
        await queryRunner.query(`ALTER TABLE "benefits" ADD CONSTRAINT "FK_ac38f8fbe45fb10e281d2e3f3f4" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "employee_benefits" ADD CONSTRAINT "FK_6f762f96c97f977adf0892b2820" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "employee_benefits" ADD CONSTRAINT "FK_fde882fa7799392110d25c80174" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "employee-kpis" ADD CONSTRAINT "FK_b2608bbd7875ed322d09c9c529d" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "employee-kpis" ADD CONSTRAINT "FK_cada35504ffffc1acb93e75a806" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "employees" ADD CONSTRAINT "FK_2d83c53c3e553a48dadb9722e38" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "employees" ADD CONSTRAINT "FK_2de5d6e4fb3345f18bc467017f0" FOREIGN KEY ("designation_id") REFERENCES "designations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "employees" ADD CONSTRAINT "FK_93a9cbef80993a39415d94b310b" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "designations" ADD CONSTRAINT "FK_97884615dba807341722aa7aa4b" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "departments" ADD CONSTRAINT "FK_146fd7019eea73f8ee7bbb52d4a" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "asset_subcategories" ADD CONSTRAINT "FK_56c0410159593c67bea82f784bc" FOREIGN KEY ("category_id") REFERENCES "asset_categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "asset_subcategories" ADD CONSTRAINT "FK_d219bd93928b621f1b2cfa96da6" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "asset_categories" ADD CONSTRAINT "FK_0627acc42a45f2b588d3a227952" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "assets" ADD CONSTRAINT "FK_bfdc3fe63eb7269f4a286252641" FOREIGN KEY ("category_id") REFERENCES "asset_categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "assets" ADD CONSTRAINT "FK_7381c8d13a865773ef06beda85e" FOREIGN KEY ("subcategory_id") REFERENCES "asset_subcategories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "leave_types" ADD CONSTRAINT "FK_02e09fb153b8a2928e4b669cc86" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "leave_types" ADD CONSTRAINT "FK_26ba185cde2ad06cdf04067ca04" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "leaves" ADD CONSTRAINT "FK_d4278e2dd5d9673eac18b6ab6f8" FOREIGN KEY ("employeeId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "leaves" ADD CONSTRAINT "FK_58160dba748dd2fc3544977e9a0" FOREIGN KEY ("leaveTypeId") REFERENCES "leave_types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "leaves" ADD CONSTRAINT "FK_3b54abe4836c3baadaf1c8e0a47" FOREIGN KEY ("approvedBy") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "leaves" ADD CONSTRAINT "FK_76c3f8b49993d46343703697012" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_a2cecd1a3531c0b041e29ba46e1" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_109638590074998bb72a2f2cf08" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payroll_records" ADD CONSTRAINT "FK_b16b8357ebd5570e91c48299ab1" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payroll_records" ADD CONSTRAINT "FK_ecf7648dbd87669698c31222cae" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payroll_records" ADD CONSTRAINT "FK_7e6f18cd4f744e9db876abed6d7" FOREIGN KEY ("generated_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payroll_records" ADD CONSTRAINT "FK_1b06c331000cfe21c6e48c346df" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payroll_configs" ADD CONSTRAINT "FK_162c1d63d27e449cb9ff4f34d9b" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "employee_salaries" ADD CONSTRAINT "FK_c2556e7b58d29a01a38af79faf6" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "employee_salaries" ADD CONSTRAINT "FK_5cee264c9d34d5836769435cb0c" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "asset_requests" ADD CONSTRAINT "FK_0ca3312f0172abc8a5261261fbc" FOREIGN KEY ("category_id") REFERENCES "asset_categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "asset_requests" ADD CONSTRAINT "FK_962ecd72bfb4c71aef3484da492" FOREIGN KEY ("subcategory_id") REFERENCES "asset_subcategories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "asset_requests" DROP CONSTRAINT "FK_962ecd72bfb4c71aef3484da492"`);
        await queryRunner.query(`ALTER TABLE "asset_requests" DROP CONSTRAINT "FK_0ca3312f0172abc8a5261261fbc"`);
        await queryRunner.query(`ALTER TABLE "employee_salaries" DROP CONSTRAINT "FK_5cee264c9d34d5836769435cb0c"`);
        await queryRunner.query(`ALTER TABLE "employee_salaries" DROP CONSTRAINT "FK_c2556e7b58d29a01a38af79faf6"`);
        await queryRunner.query(`ALTER TABLE "payroll_configs" DROP CONSTRAINT "FK_162c1d63d27e449cb9ff4f34d9b"`);
        await queryRunner.query(`ALTER TABLE "payroll_records" DROP CONSTRAINT "FK_1b06c331000cfe21c6e48c346df"`);
        await queryRunner.query(`ALTER TABLE "payroll_records" DROP CONSTRAINT "FK_7e6f18cd4f744e9db876abed6d7"`);
        await queryRunner.query(`ALTER TABLE "payroll_records" DROP CONSTRAINT "FK_ecf7648dbd87669698c31222cae"`);
        await queryRunner.query(`ALTER TABLE "payroll_records" DROP CONSTRAINT "FK_b16b8357ebd5570e91c48299ab1"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_109638590074998bb72a2f2cf08"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_a2cecd1a3531c0b041e29ba46e1"`);
        await queryRunner.query(`ALTER TABLE "leaves" DROP CONSTRAINT "FK_76c3f8b49993d46343703697012"`);
        await queryRunner.query(`ALTER TABLE "leaves" DROP CONSTRAINT "FK_3b54abe4836c3baadaf1c8e0a47"`);
        await queryRunner.query(`ALTER TABLE "leaves" DROP CONSTRAINT "FK_58160dba748dd2fc3544977e9a0"`);
        await queryRunner.query(`ALTER TABLE "leaves" DROP CONSTRAINT "FK_d4278e2dd5d9673eac18b6ab6f8"`);
        await queryRunner.query(`ALTER TABLE "leave_types" DROP CONSTRAINT "FK_26ba185cde2ad06cdf04067ca04"`);
        await queryRunner.query(`ALTER TABLE "leave_types" DROP CONSTRAINT "FK_02e09fb153b8a2928e4b669cc86"`);
        await queryRunner.query(`ALTER TABLE "assets" DROP CONSTRAINT "FK_7381c8d13a865773ef06beda85e"`);
        await queryRunner.query(`ALTER TABLE "assets" DROP CONSTRAINT "FK_bfdc3fe63eb7269f4a286252641"`);
        await queryRunner.query(`ALTER TABLE "asset_categories" DROP CONSTRAINT "FK_0627acc42a45f2b588d3a227952"`);
        await queryRunner.query(`ALTER TABLE "asset_subcategories" DROP CONSTRAINT "FK_d219bd93928b621f1b2cfa96da6"`);
        await queryRunner.query(`ALTER TABLE "asset_subcategories" DROP CONSTRAINT "FK_56c0410159593c67bea82f784bc"`);
        await queryRunner.query(`ALTER TABLE "departments" DROP CONSTRAINT "FK_146fd7019eea73f8ee7bbb52d4a"`);
        await queryRunner.query(`ALTER TABLE "designations" DROP CONSTRAINT "FK_97884615dba807341722aa7aa4b"`);
        await queryRunner.query(`ALTER TABLE "employees" DROP CONSTRAINT "FK_93a9cbef80993a39415d94b310b"`);
        await queryRunner.query(`ALTER TABLE "employees" DROP CONSTRAINT "FK_2de5d6e4fb3345f18bc467017f0"`);
        await queryRunner.query(`ALTER TABLE "employees" DROP CONSTRAINT "FK_2d83c53c3e553a48dadb9722e38"`);
        await queryRunner.query(`ALTER TABLE "employee-kpis" DROP CONSTRAINT "FK_cada35504ffffc1acb93e75a806"`);
        await queryRunner.query(`ALTER TABLE "employee-kpis" DROP CONSTRAINT "FK_b2608bbd7875ed322d09c9c529d"`);
        await queryRunner.query(`ALTER TABLE "employee_benefits" DROP CONSTRAINT "FK_fde882fa7799392110d25c80174"`);
        await queryRunner.query(`ALTER TABLE "employee_benefits" DROP CONSTRAINT "FK_6f762f96c97f977adf0892b2820"`);
        await queryRunner.query(`ALTER TABLE "benefits" DROP CONSTRAINT "FK_ac38f8fbe45fb10e281d2e3f3f4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5cee264c9d34d5836769435cb0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c2556e7b58d29a01a38af79faf"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_62bceba317b975fe7781980a25"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fe4052e005112ea36363ae926c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ecf7648dbd87669698c31222ca"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b16b8357ebd5570e91c48299ab"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_76c3f8b49993d4634370369701"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8cf18b9a419a38a23e31c4ce30"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_58160dba748dd2fc3544977e9a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d4278e2dd5d9673eac18b6ab6f"`);
        await queryRunner.query(`ALTER TABLE "employee_salaries" DROP COLUMN "deleted_at"`);
        await queryRunner.query(`ALTER TABLE "employee_salaries" ADD "deleted_at" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "employee_salaries" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "employee_salaries" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "employee_salaries" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "employee_salaries" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "payroll_configs" DROP COLUMN "deleted_at"`);
        await queryRunner.query(`ALTER TABLE "payroll_configs" ADD "deleted_at" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "payroll_configs" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "payroll_configs" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "payroll_configs" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "payroll_configs" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "payroll_records" DROP COLUMN "deleted_at"`);
        await queryRunner.query(`ALTER TABLE "payroll_records" ADD "deleted_at" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "payroll_records" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "payroll_records" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "payroll_records" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "payroll_records" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "tenants" ALTER COLUMN "updated_at" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "tenants" ALTER COLUMN "created_at" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN "name"`);
        await queryRunner.query(`ALTER TABLE "tenants" ADD "name" character varying(255) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "leaves" ALTER COLUMN "tenantId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "leaves" ALTER COLUMN "totalDays" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "leaves" ALTER COLUMN "leaveTypeId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "asset_categories" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "asset_categories" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "asset_subcategories" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "asset_subcategories" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "tenants" ADD "description" text`);
        await queryRunner.query(`CREATE INDEX "IDX_asset_requests_subcategory" ON "asset_requests" ("subcategory_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_employee_salaries_employee_id" ON "employee_salaries" ("employee_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_employee_salaries_tenant_id" ON "employee_salaries" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_payroll_configs_tenant_id" ON "payroll_configs" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_payroll_records_month_year" ON "payroll_records" ("month", "year") `);
        await queryRunner.query(`CREATE INDEX "IDX_payroll_records_employee_id" ON "payroll_records" ("employee_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_payroll_records_tenant_id" ON "payroll_records" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_leaves_status" ON "leaves" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_leaves_tenant" ON "leaves" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_leaves_leaveType" ON "leaves" ("leaveTypeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_leaves_employee" ON "leaves" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_leave_types_status" ON "leave_types" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_leave_types_tenant" ON "leave_types" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_assets_subcategory" ON "assets" ("subcategory_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_asset_categories_unique" ON "asset_categories" ("name", "tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_asset_categories_tenant" ON "asset_categories" ("tenant_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_asset_subcategories_unique" ON "asset_subcategories" ("category_id", "name", "tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_asset_subcategories_tenant" ON "asset_subcategories" ("tenant_id") `);
        await queryRunner.query(`ALTER TABLE "asset_requests" ADD CONSTRAINT "FK_asset_requests_subcategory" FOREIGN KEY ("subcategory_id") REFERENCES "asset_subcategories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "asset_requests" ADD CONSTRAINT "FK_asset_requests_category" FOREIGN KEY ("category_id") REFERENCES "asset_categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "employee_salaries" ADD CONSTRAINT "FK_employee_salaries_tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "employee_salaries" ADD CONSTRAINT "FK_employee_salaries_employee_id" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payroll_configs" ADD CONSTRAINT "FK_payroll_configs_tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payroll_records" ADD CONSTRAINT "FK_payroll_records_tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payroll_records" ADD CONSTRAINT "FK_payroll_records_employee_id" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payroll_records" ADD CONSTRAINT "FK_payroll_records_generated_by" FOREIGN KEY ("generated_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payroll_records" ADD CONSTRAINT "FK_payroll_records_approved_by" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_a2cecd1a3531c0b041e29ba46e1" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_109638590074998bb72a2f2cf08" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "leaves" ADD CONSTRAINT "FK_80500bfd86d628c5e9fdcb49fac" FOREIGN KEY ("employeeId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "leaves" ADD CONSTRAINT "FK_leaves_employee" FOREIGN KEY ("employeeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "leaves" ADD CONSTRAINT "FK_leaves_leaveType" FOREIGN KEY ("leaveTypeId") REFERENCES "leave_types"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "leaves" ADD CONSTRAINT "FK_leaves_approver" FOREIGN KEY ("approvedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "leaves" ADD CONSTRAINT "FK_leaves_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "leaves" ADD CONSTRAINT "FK_76c3f8b49993d46343703697012" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "leave_types" ADD CONSTRAINT "FK_leave_types_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "leave_types" ADD CONSTRAINT "FK_leave_types_creator" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "assets" ADD CONSTRAINT "FK_assets_subcategory" FOREIGN KEY ("subcategory_id") REFERENCES "asset_subcategories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "assets" ADD CONSTRAINT "FK_assets_category" FOREIGN KEY ("category_id") REFERENCES "asset_categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "asset_categories" ADD CONSTRAINT "FK_asset_categories_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "asset_subcategories" ADD CONSTRAINT "FK_asset_subcategories_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "asset_subcategories" ADD CONSTRAINT "FK_subcategories_category" FOREIGN KEY ("category_id") REFERENCES "asset_categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "departments" ADD CONSTRAINT "FK_146fd7019eea73f8ee7bbb52d4a" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "designations" ADD CONSTRAINT "FK_97884615dba807341722aa7aa4b" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "employees" ADD CONSTRAINT "FK_2d83c53c3e553a48dadb9722e38" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "employees" ADD CONSTRAINT "FK_2de5d6e4fb3345f18bc467017f0" FOREIGN KEY ("designation_id") REFERENCES "designations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "employees" ADD CONSTRAINT "FK_93a9cbef80993a39415d94b310b" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "employee-kpis" ADD CONSTRAINT "FK_b2608bbd7875ed322d09c9c529d" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "employee-kpis" ADD CONSTRAINT "FK_cada35504ffffc1acb93e75a806" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "employee_benefits" ADD CONSTRAINT "FK_6f762f96c97f977adf0892b2820" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "employee_benefits" ADD CONSTRAINT "FK_fde882fa7799392110d25c80174" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "benefits" ADD CONSTRAINT "FK_ac38f8fbe45fb10e281d2e3f3f4" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
