import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDocumentsToLeaves1769000000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "leaves" 
      ADD COLUMN "documents" text[] DEFAULT '{}'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('leaves', 'documents');
  }
}

