import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackfillEmailVerifiedFromInviteStatus1773000000002
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Fetch all tenants that have a provisioned schema
    const tenants: { id: string }[] = await queryRunner.query(
      `SELECT id FROM public.tenants WHERE schema_provisioned = TRUE`,
    );

    for (const tenant of tenants) {
      const schemaName = `tenant_${tenant.id.replace(/-/g, '')}`;

      // Collect user_ids of employees with invite_status = 'Joined' in this tenant schema
      const joinedRows: { user_id: string }[] = await queryRunner.query(
        `SELECT user_id FROM "${schemaName}".employees WHERE invite_status = 'Joined'`,
      );

      if (joinedRows.length > 0) {
        const joinedUserIds = joinedRows.map((r) => r.user_id);

        // Mark those users as email_verified = true
        await queryRunner.query(
          `UPDATE public.users
             SET email_verified = TRUE
           WHERE id = ANY($1::uuid[])`,
          [joinedUserIds],
        );
      }
    }

    // All remaining users whose email_verified is still FALSE stay FALSE (already the default)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reset all email_verified flags set by this migration back to false
    await queryRunner.query(
      `UPDATE public.users SET email_verified = FALSE WHERE email_verified = TRUE`,
    );
  }
}
