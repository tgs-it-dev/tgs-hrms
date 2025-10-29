import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddCnicAndPicturesToEmployee1765000000000 implements MigrationInterface {
  name = 'AddCnicAndPicturesToEmployee1765000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'employees',
      new TableColumn({
        name: 'cnic_number',
        type: 'varchar',
        length: '15',
        isNullable: true,
      })
    );

    await queryRunner.addColumn(
      'employees',
      new TableColumn({
        name: 'profile_picture',
        type: 'varchar',
        length: '500',
        isNullable: true,
      })
    );

    await queryRunner.addColumn(
      'employees',
      new TableColumn({
        name: 'cnic_picture',
        type: 'varchar',
        length: '500',
        isNullable: true,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('employees', 'cnic_picture');
    await queryRunner.dropColumn('employees', 'profile_picture');
    await queryRunner.dropColumn('employees', 'cnic_number');
  }
}
