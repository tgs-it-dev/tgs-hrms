import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedSubscriptionPlans17724662076662123 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('subscription_plans');
    if (!hasTable) return;

    await queryRunner.query(`DELETE FROM "subscription_plans"`);
    await queryRunner.query(`
            INSERT INTO "subscription_plans" ("id", "name", "stripePriceId", "description", "created_at", "updated_at") VALUES
            ('b90b5233-33e4-42ef-8e03-4b2c54b0e981', 'Basic Plan', 'price_1SuFmoP6LvaPqz5tlhGBirzs', 'Basic HRMS features.Employee profile management with essential details.Department and designation setup.Leave request and approval workflow (basic).Attendance tracking (manual entry).Standard reports (PDF/Excel export)', '2025-09-20T20:53:19.549Z', '2025-09-20T20:53:19.549Z'),
            ('f1006e4a-422a-4653-8f7f-4b0feaf5d824', 'Pro Plan', 'price_1SuGChP6LvaPqz5t935ECjzC', 'Advanced features for growing teams.All Basic features  included.Role-based access control (Admin, Manager, Employee).Automated attendance with shift scheduling.Payroll integration (basic salary slips).Advanced reports & analytics dashboard', '2025-09-20T20:53:19.549Z', '2025-09-20T20:53:19.549Z'),
            ('cd939691-415a-4516-b2a5-deb776f70595', 'Enterprise Plan', 'price_1SuGE2P6LvaPqz5t0uTd9GWr', 'Enterprise-grade features and support.All Standard features included.Multi-tenant support for multiple companies/branches.Customizable workflows (approvals, leave policies, etc).API access & third-party integrations (ERP, Finance, etc).Dedicated support, SLA & priority onboarding.', '2025-09-20T20:53:19.549Z', '2025-09-20T20:53:19.549Z'),
            ('6820914e-4e40-457f-8a56-f190f13a9421', 'Add Employee', 'price_1SudUbP6LvaPqz5tjK6kdJfT', 'For Adding Employees', '2025-12-29T17:20:12.878Z', '2025-12-29T17:20:12.878Z')
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('subscription_plans'))) return;
    await queryRunner.query(`DELETE FROM "subscription_plans"`);
  }
}
