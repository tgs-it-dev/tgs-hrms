import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDesignation1751894607679 implements MigrationInterface {
    name = 'AddDesignation1751894607679'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "designations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying(120) NOT NULL, "tenantId" uuid NOT NULL, "departmentId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a0f024b99b1491a03fc421858ea" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_f31e027c8234b5d8ffecb04687" ON "designations" ("departmentId", "title") `);
        await queryRunner.query(`ALTER TABLE "designations" ADD CONSTRAINT "FK_13b9ac48f0fa4a277c821cdcc4c" FOREIGN KEY ("tenantId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "designations" ADD CONSTRAINT "FK_7c44e083cd67fd42d3e2f892ccc" FOREIGN KEY ("departmentId") REFERENCES "department"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "designations" DROP CONSTRAINT "FK_7c44e083cd67fd42d3e2f892ccc"`);
        await queryRunner.query(`ALTER TABLE "designations" DROP CONSTRAINT "FK_13b9ac48f0fa4a277c821cdcc4c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f31e027c8234b5d8ffecb04687"`);
        await queryRunner.query(`DROP TABLE "designations"`);
    }

}
