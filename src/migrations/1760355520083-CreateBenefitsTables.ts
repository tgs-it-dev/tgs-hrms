import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateBenefitsTables1760355520083 implements MigrationInterface {
  name = "CreateBenefitsTables1760355520083";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create benefits table if not exists
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "benefits" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(255) NOT NULL,
        "description" text,
        "type" character varying(100) NOT NULL,
        "eligibility_criteria" text,
        "status" character varying(20) NOT NULL DEFAULT 'active',
        "tenant_id" uuid NOT NULL,
        "created_by" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_f83fd5765028f20487943258b46" PRIMARY KEY ("id")
      );
    `);

    // Create employee_benefits table if not exists
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "employee_benefits" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "employee_id" uuid NOT NULL,
        "benefit_id" uuid NOT NULL,
        "start_date" date NOT NULL,
        "end_date" date,
        "status" character varying(20) NOT NULL DEFAULT 'active',
        "assigned_by" uuid NOT NULL,
        "tenant_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_763646c5c1e07c6973404d9d59a" PRIMARY KEY ("id")
      );
    `);

    // Employees table modifications
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'status') THEN
          ALTER TABLE "employees" DROP COLUMN "status";
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'FK_93a9cbef80993a39415d94b310b'
        ) THEN
          ALTER TABLE "employees" DROP CONSTRAINT "FK_93a9cbef80993a39415d94b310b";
        END IF;
      END $$;
    `);

    // Foreign Keys with existence checks
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'FK_ac38f8fbe45fb10e281d2e3f3f4'
        ) THEN
          ALTER TABLE "benefits"
          ADD CONSTRAINT "FK_ac38f8fbe45fb10e281d2e3f3f4"
          FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'FK_6f762f96c97f977adf0892b2820'
        ) THEN
          ALTER TABLE "employee_benefits"
          ADD CONSTRAINT "FK_6f762f96c97f977adf0892b2820"
          FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'FK_b71e5c8ec86a3c1a881b5952614'
        ) THEN
          ALTER TABLE "employee_benefits"
          ADD CONSTRAINT "FK_b71e5c8ec86a3c1a881b5952614"
          FOREIGN KEY ("benefit_id") REFERENCES "benefits"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'FK_fde882fa7799392110d25c80174'
        ) THEN
          ALTER TABLE "employee_benefits"
          ADD CONSTRAINT "FK_fde882fa7799392110d25c80174"
          FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'FK_93a9cbef80993a39415d94b310b'
        ) THEN
          ALTER TABLE "employees"
          ADD CONSTRAINT "FK_93a9cbef80993a39415d94b310b"
          FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop constraints if exist
    const constraints = [
      "FK_93a9cbef80993a39415d94b310b",
      "FK_fde882fa7799392110d25c80174",
      "FK_b71e5c8ec86a3c1a881b5952614",
      "FK_6f762f96c97f977adf0892b2820",
      "FK_ac38f8fbe45fb10e281d2e3f3f4",
    ];
    for (const c of constraints) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = '${c}'
          ) THEN
            ALTER TABLE "employees" DROP CONSTRAINT IF EXISTS "${c}";
            ALTER TABLE "employee_benefits" DROP CONSTRAINT IF EXISTS "${c}";
            ALTER TABLE "benefits" DROP CONSTRAINT IF EXISTS "${c}";
          END IF;
        END $$;
      `);
    }

    // Safely revert column changes
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "first_login_time" DROP NOT NULL;`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "profile_pic";`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profile_pic" character varying(500);`,
    );

    await queryRunner.query(
      `ALTER TABLE "employees" DROP COLUMN IF EXISTS "invite_status";`,
    );
    await queryRunner.query(
      `ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "invite_status" character varying(20) NOT NULL DEFAULT 'Invite Sent';`,
    );
    await queryRunner.query(
      `ALTER TABLE "employees" ALTER COLUMN "team_id" DROP NOT NULL;`,
    );

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'FK_93a9cbef80993a39415d94b310b'
        ) THEN
          ALTER TABLE "employees"
          ADD CONSTRAINT "FK_93a9cbef80993a39415d94b310b"
          FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(
      `ALTER TABLE "departments" ALTER COLUMN "description" DROP NOT NULL;`,
    );
    await queryRunner.query(
      `ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "status" character varying(20) NOT NULL DEFAULT 'active';`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "employee_benefits";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "benefits";`);
  }
}
