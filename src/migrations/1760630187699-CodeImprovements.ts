import { MigrationInterface, QueryRunner } from "typeorm";

export class CodeImprovements1760630187699 implements MigrationInterface {
    name = 'CodeImprovements1760630187699'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "assets" DROP CONSTRAINT "FK_assets_tenant"`);
        await queryRunner.query(`ALTER TABLE "assets" DROP CONSTRAINT "FK_assets_assigned_to_user"`);
        await queryRunner.query(`ALTER TABLE "asset_requests" DROP CONSTRAINT "FK_asset_requests_tenant"`);
        await queryRunner.query(`ALTER TABLE "asset_requests" DROP CONSTRAINT "FK_asset_requests_approved_by_user"`);
        await queryRunner.query(`ALTER TABLE "asset_requests" DROP CONSTRAINT "FK_asset_requests_requested_by_user"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_assets_tenant"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_asset_requests_tenant"`);
        await queryRunner.query(`ALTER TABLE "employees" ADD "status" character varying(20) NOT NULL DEFAULT 'active'`);
        await queryRunner.query(`ALTER TABLE "assets" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "assets" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "asset_requests" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "asset_requests" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "assets" ADD CONSTRAINT "FK_6ce7e037e1bac19ddf02d1d82d6" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "assets" ADD CONSTRAINT "FK_35832939b4bc039606a21fc27ee" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "asset_requests" ADD CONSTRAINT "FK_81ac2fe506bb08953b3c455098d" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "asset_requests" ADD CONSTRAINT "FK_6400d5a6b29f60976d514591a21" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "asset_requests" ADD CONSTRAINT "FK_971015d490bde7b67e113e51a12" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "asset_requests" DROP CONSTRAINT "FK_971015d490bde7b67e113e51a12"`);
        await queryRunner.query(`ALTER TABLE "asset_requests" DROP CONSTRAINT "FK_6400d5a6b29f60976d514591a21"`);
        await queryRunner.query(`ALTER TABLE "asset_requests" DROP CONSTRAINT "FK_81ac2fe506bb08953b3c455098d"`);
        await queryRunner.query(`ALTER TABLE "assets" DROP CONSTRAINT "FK_35832939b4bc039606a21fc27ee"`);
        await queryRunner.query(`ALTER TABLE "assets" DROP CONSTRAINT "FK_6ce7e037e1bac19ddf02d1d82d6"`);
        await queryRunner.query(`ALTER TABLE "asset_requests" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "asset_requests" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "assets" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "assets" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "employees" DROP COLUMN "status"`);
        await queryRunner.query(`CREATE INDEX "IDX_asset_requests_tenant" ON "asset_requests" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_assets_tenant" ON "assets" ("tenant_id") `);
        await queryRunner.query(`ALTER TABLE "asset_requests" ADD CONSTRAINT "FK_asset_requests_requested_by_user" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "asset_requests" ADD CONSTRAINT "FK_asset_requests_approved_by_user" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "asset_requests" ADD CONSTRAINT "FK_asset_requests_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "assets" ADD CONSTRAINT "FK_assets_assigned_to_user" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "assets" ADD CONSTRAINT "FK_assets_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
