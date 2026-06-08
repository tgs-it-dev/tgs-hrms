import { MigrationInterface, QueryRunner } from 'typeorm';

const ADMIN_ROLE_NAMES = ['Admin', 'System-Admin', 'network-admin', 'hr-admin'];

export class BackfillEmailVerifiedForAdminRoles1773000000003
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE public.users u
          SET email_verified = TRUE
         FROM public.roles r
        WHERE u.role_id = r.id
          AND r.name = ANY($1::text[])`,
      [ADMIN_ROLE_NAMES],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE public.users u
          SET email_verified = FALSE
         FROM public.roles r
        WHERE u.role_id = r.id
          AND r.name = ANY($1::text[])`,
      [ADMIN_ROLE_NAMES],
    );
  }
}
