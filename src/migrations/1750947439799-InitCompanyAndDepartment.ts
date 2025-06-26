import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitCompanyAndDepartment1750947439799 implements MigrationInterface {
  name = 'InitCompanyAndDepartment1750947439799';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "department" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" uuid NOT NULL, "name" character varying(100) NOT NULL, "description" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_9a2213262c1593bffb581e382f5" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_e58e500747caf6053616faaf37" ON "department" ("tenantId", "name") `
    );
    await queryRunner.query(
      `CREATE TABLE "company" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(120) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_056f7854a7afdba7cbd6d45fc20" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `ALTER TABLE "department" ADD CONSTRAINT "FK_3e4a8c5002af8902cb5f6645d1d" FOREIGN KEY ("tenantId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "department" DROP CONSTRAINT "FK_3e4a8c5002af8902cb5f6645d1d"`
    );
    await queryRunner.query(`DROP TABLE "company"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_e58e500747caf6053616faaf37"`);
    await queryRunner.query(`DROP TABLE "department"`);
  }
}
