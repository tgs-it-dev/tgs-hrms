import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTimesheetTable1755133478840 implements MigrationInterface {
    name = 'CreateTimesheetTable1755133478840'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "timesheets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "start_time" TIMESTAMP WITH TIME ZONE NOT NULL, "end_time" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1dc280b68c9353ecce41a34be71" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_695d88ff83c43d6788dbc264f8" ON "timesheets" ("user_id", "end_time") `);
        await queryRunner.query(`ALTER TABLE "timesheets" ADD CONSTRAINT "FK_e87f4a4a85cb9932938c695a692" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "timesheets" DROP CONSTRAINT "FK_e87f4a4a85cb9932938c695a692"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_695d88ff83c43d6788dbc264f8"`);
        await queryRunner.query(`DROP TABLE "timesheets"`);
    }

}
