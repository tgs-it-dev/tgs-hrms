import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackfillEmailVerifiedFromInviteStatus1773000000002
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const tenants: { id: string; schema_provisioned: boolean }[] =
      await queryRunner.query(
        `SELECT id, schema_provisioned FROM public.tenants`,
      );

    for (const tenant of tenants) {
      let joinedRows: { user_id: string }[];

      if (tenant.schema_provisioned) {
        const schemaName = `tenant_${tenant.id.replace(/-/g, '')}`;
        joinedRows = await queryRunner.query(
          `SELECT user_id FROM "${schemaName}".employees WHERE invite_status = 'Joined'`,
        );
      } else {
        joinedRows = await queryRunner.query(
          `SELECT e.user_id FROM public.employees e
             INNER JOIN public.users u ON u.id = e.user_id
           WHERE e.invite_status = 'Joined'
             AND u.tenant_id = $1`,
          [tenant.id],
        );
      }

      if (joinedRows.length > 0) {
        const joinedUserIds = joinedRows.map((r) => r.user_id);
        await queryRunner.query(
          `UPDATE public.users
             SET email_verified = TRUE
           WHERE id = ANY($1::uuid[])`,
          [joinedUserIds],
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reset all email_verified flags set by this migration back to false
    await queryRunner.query(
      `UPDATE public.users SET email_verified = FALSE WHERE email_verified = TRUE`,
    );
  }
}
