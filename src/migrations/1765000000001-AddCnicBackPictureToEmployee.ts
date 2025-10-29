import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddCnicBackPictureToEmployee1765000000001 implements MigrationInterface {
  name = 'AddCnicBackPictureToEmployee1765000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'employees',
      new TableColumn({
        name: 'cnic_back_picture',
        type: 'varchar',
        length: '500',
        isNullable: true,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('employees', 'cnic_back_picture');
  }
}
