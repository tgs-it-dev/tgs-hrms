import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackfillEmailVerifiedFromInviteStatus1773000000002
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Handle all unprovisioned tenants in one query — avoids per-tenant loops
    await queryRunner.query(
      `UPDATE public.users u
          SET email_verified = TRUE
         FROM public.employees e, public.tenants t
        WHERE e.user_id = u.id
          AND t.id = u.tenant_id
          AND e.invite_status = 'Joined'
          AND t.schema_provisioned = FALSE`,
    );

    // Provisioned tenants each have their own schema — must loop
    const provisionedTenants: { id: string }[] = await queryRunner.query(
      `SELECT id FROM public.tenants WHERE schema_provisioned = TRUE`,
    );

    for (const tenant of provisionedTenants) {
      const schemaName = `tenant_${tenant.id.replace(/-/g, '')}`;

      // Push the join into SQL — no intermediate array in Node
      await queryRunner.query(
        `UPDATE public.users u
            SET email_verified = TRUE
           FROM "${schemaName}".employees e
          WHERE e.user_id = u.id
            AND e.invite_status = 'Joined'`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reset all email_verified flags set by this migration back to false
    await queryRunner.query(
      `UPDATE public.users SET email_verified = FALSE WHERE email_verified = TRUE`,
    );
  }
}
