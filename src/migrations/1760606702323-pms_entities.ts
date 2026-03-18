import { MigrationInterface, QueryRunner } from "typeorm";

export class PmsEntities1760606702323 implements MigrationInterface {
  name = "PmsEntities1760606702323";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "kpis" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying(255) NOT NULL, "description" text, "weight" double precision NOT NULL, "category" character varying(100) NOT NULL, "tenantId" character varying NOT NULL, "createdBy" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'active', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "tenant_id" uuid NOT NULL, CONSTRAINT "PK_96cc541107cdc102a50e2b0ac90" PRIMARY KEY ("id")); COMMENT ON COLUMN "kpis"."weight" IS 'Percentage weight in evaluation'`,
    );
    await queryRunner.query(
      `CREATE TABLE "employee-kpis" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "employeeId" character varying NOT NULL, "kpiId" character varying NOT NULL, "targetValue" double precision NOT NULL, "achievedValue" double precision NOT NULL, "score" double precision NOT NULL, "reviewCycle" character varying(50) NOT NULL, "reviewedBy" uuid, "remarks" text, "tenantId" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "kpi_id" uuid NOT NULL, "employee_id" uuid NOT NULL, "tenant_id" uuid NOT NULL, CONSTRAINT "PK_6d917bf98e1fda1cbacd4d31c6d" PRIMARY KEY ("id")); COMMENT ON COLUMN "employee-kpis"."targetValue" IS 'Percentage value'; COMMENT ON COLUMN "employee-kpis"."achievedValue" IS 'Percentage value'; COMMENT ON COLUMN "employee-kpis"."score" IS '1-5 scale (achieved / target)'; COMMENT ON COLUMN "employee-kpis"."reviewCycle" IS 'e.g., Q4-2025'; COMMENT ON COLUMN "employee-kpis"."reviewedBy" IS 'manager id'`,
    );
    await queryRunner.query(
      `CREATE TABLE "performance_reviews" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "employee_id" uuid NOT NULL, "cycle" character varying(50) NOT NULL, "overallScore" double precision NOT NULL, "status" character varying NOT NULL DEFAULT 'pending', "reviewedBy" character varying, "approvedBy" character varying, "recommendation" text, "tenantId" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "tenant_id" uuid NOT NULL, CONSTRAINT "PK_46f39f620497eb3de4fe6dafdef" PRIMARY KEY ("id")); COMMENT ON COLUMN "performance_reviews"."cycle" IS 'e.g., Q4-2025'`,
    );
    await queryRunner.query(
      `CREATE TABLE "promotions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "employeeId" character varying NOT NULL, "previousDesignation" character varying NOT NULL, "newDesignation" character varying NOT NULL, "effectiveDate" date NOT NULL, "approvedBy" character varying, "status" character varying NOT NULL DEFAULT 'pending', "remarks" text, "tenantId" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "employee_id" uuid NOT NULL, "tenant_id" uuid NOT NULL, CONSTRAINT "PK_380cecbbe3ac11f0e5a7c452c34" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "employees" DROP CONSTRAINT "FK_93a9cbef80993a39415d94b310b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "kpis" ADD CONSTRAINT "FK_480d834b279982a9714e6b53028" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "employee-kpis" ADD CONSTRAINT "FK_8b5c5d2e292f9d91d751e0c421a" FOREIGN KEY ("kpi_id") REFERENCES "kpis"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "employee-kpis" ADD CONSTRAINT "FK_b2608bbd7875ed322d09c9c529d" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "employee-kpis" ADD CONSTRAINT "FK_cada35504ffffc1acb93e75a806" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "performance_reviews" ADD CONSTRAINT "FK_2d1d9e46c9f01ac7c07d59b2756" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "performance_reviews" ADD CONSTRAINT "FK_b9a0441863f21815d352c42b774" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "promotions" ADD CONSTRAINT "FK_48fae57f93a56c66ea7310a3ed8" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "promotions" ADD CONSTRAINT "FK_f8bcbc3a412f82f76f493769a98" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "employees" ADD CONSTRAINT "FK_93a9cbef80993a39415d94b310b" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "employees" DROP CONSTRAINT "FK_93a9cbef80993a39415d94b310b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "promotions" DROP CONSTRAINT "FK_f8bcbc3a412f82f76f493769a98"`,
    );
    await queryRunner.query(
      `ALTER TABLE "promotions" DROP CONSTRAINT "FK_48fae57f93a56c66ea7310a3ed8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "performance_reviews" DROP CONSTRAINT "FK_b9a0441863f21815d352c42b774"`,
    );
    await queryRunner.query(
      `ALTER TABLE "performance_reviews" DROP CONSTRAINT "FK_2d1d9e46c9f01ac7c07d59b2756"`,
    );
    await queryRunner.query(
      `ALTER TABLE "employee-kpis" DROP CONSTRAINT "FK_cada35504ffffc1acb93e75a806"`,
    );
    await queryRunner.query(
      `ALTER TABLE "employee-kpis" DROP CONSTRAINT "FK_b2608bbd7875ed322d09c9c529d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "employee-kpis" DROP CONSTRAINT "FK_8b5c5d2e292f9d91d751e0c421a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "kpis" DROP CONSTRAINT "FK_480d834b279982a9714e6b53028"`,
    );
    await queryRunner.query(
      `ALTER TABLE "employees" ALTER COLUMN "team_id" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "employees" ADD CONSTRAINT "FK_93a9cbef80993a39415d94b310b" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(`DROP TABLE "promotions"`);
    await queryRunner.query(`DROP TABLE "performance_reviews"`);
    await queryRunner.query(`DROP TABLE "employee-kpis"`);
    await queryRunner.query(`DROP TABLE "kpis"`);
  }
}
