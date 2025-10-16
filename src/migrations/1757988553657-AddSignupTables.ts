import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSignupTables1757988553657 implements MigrationInterface {
    name = 'AddSignupTables1757988553657'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "company_details" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_name" character varying NOT NULL, "domain" character varying NOT NULL, "plan_id" character varying NOT NULL, "seats" integer NOT NULL, "is_paid" boolean NOT NULL DEFAULT false, "stripe_customer_id" character varying, "stripe_session_id" character varying, "stripe_payment_intent_id" character varying, "signup_session_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "REL_ad5e96d2ce8d90267cc417746a" UNIQUE ("signup_session_id"), CONSTRAINT "PK_36b605d66617cf62e4b3a0161dc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "signup_sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "password_hash" character varying NOT NULL, "first_name" character varying NOT NULL, "last_name" character varying NOT NULL, "phone" character varying NOT NULL, "status" character varying(30) NOT NULL DEFAULT 'personal_completed', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_0e8e3aae1b941a367a556fba829" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "company_details" ADD CONSTRAINT "FK_ad5e96d2ce8d90267cc417746ac" FOREIGN KEY ("signup_session_id") REFERENCES "signup_sessions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "company_details" DROP CONSTRAINT "FK_ad5e96d2ce8d90267cc417746ac"`);
        await queryRunner.query(`DROP TABLE "signup_sessions"`);
        await queryRunner.query(`DROP TABLE "company_details"`);
    }

}
