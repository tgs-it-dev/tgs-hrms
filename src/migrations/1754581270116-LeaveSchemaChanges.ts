import { MigrationInterface, QueryRunner } from "typeorm";

export class LeaveSchemaChanges1754581270116 implements MigrationInterface {
    name = 'LeaveSchemaChanges1754581270116'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "leaves" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "from_date" date NOT NULL, "to_date" date NOT NULL, "reason" text NOT NULL, "type" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'pending', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_4153ec7270da3d07efd2e11e2a7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "leaves" ADD CONSTRAINT "FK_80500bfd86d628c5e9fdcb49fac" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "leaves" DROP CONSTRAINT "FK_80500bfd86d628c5e9fdcb49fac"`);
        await queryRunner.query(`DROP TABLE "leaves"`);
    }

}
