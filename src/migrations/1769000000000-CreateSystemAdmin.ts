import { MigrationInterface, QueryRunner } from "typeorm";
import { v4 as uuidv4 } from "uuid";
import * as bcrypt from "bcrypt";

export class CreateSystemAdmin1769000000000 implements MigrationInterface {
  name = "CreateSystemAdmin1769000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Global System Tenant ID
    const GLOBAL_SYSTEM_TENANT_ID = "00000000-0000-0000-0000-000000000000";

    // Get System-Admin role (check both "System-Admin" and "system-admin" names)
    const systemAdminRole = await queryRunner.query(
      `SELECT id FROM roles WHERE name IN ('System-Admin', 'system-admin') LIMIT 1`
    );

    if (!systemAdminRole || systemAdminRole.length === 0) {
      throw new Error(
        "System-Admin role not found. Please ensure roles are seeded first."
      );
    }

    const roleId = systemAdminRole[0].id;

    // Default system admin credentials (should be changed after first login)
    const defaultEmail = "kaxip53990@gusronk.com";
    const defaultPassword = "Nouman123"; // Change this after first login!

    // Check if user with this email already exists
    const existingUser = await queryRunner.query(
      `SELECT id FROM users WHERE email = $1 LIMIT 1`,
      [defaultEmail.toLowerCase()]
    );

    if (existingUser && existingUser.length > 0) {
      console.log(`User with email ${defaultEmail} already exists. Skipping creation.`);
      return;
    }

    // Check if system admin already exists with global tenant ID
    const existingAdmin = await queryRunner.query(
      `SELECT id FROM users WHERE role_id = $1 AND tenant_id = $2 LIMIT 1`,
      [roleId, GLOBAL_SYSTEM_TENANT_ID]
    );

    if (existingAdmin && existingAdmin.length > 0) {
      console.log("System admin already exists. Skipping creation.");
      return;
    }

    const hashedPassword = await bcrypt.hash(defaultPassword, 10);
    const userId = uuidv4();

    // Create system admin user
    await queryRunner.query(
      `INSERT INTO users (
        id, 
        email, 
        password, 
        first_name, 
        last_name, 
        phone, 
        role_id, 
        tenant_id, 
        created_at, 
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
      [
        userId,
        defaultEmail.toLowerCase(),
        hashedPassword,
        "System",
        "Admin",
        "+1234567890", // Default phone, should be updated
        roleId,
        GLOBAL_SYSTEM_TENANT_ID,
      ]
    );

    console.log(
      `System admin created successfully with email: ${defaultEmail}`
    );
    console.log(
      `⚠️  IMPORTANT: Default password is "${defaultPassword}" - Please change it after first login!`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const GLOBAL_SYSTEM_TENANT_ID = "00000000-0000-0000-0000-000000000000";

    // Get System-Admin role
    const systemAdminRole = await queryRunner.query(
      `SELECT id FROM roles WHERE name IN ('System-Admin', 'system-admin') LIMIT 1`
    );

    if (systemAdminRole && systemAdminRole.length > 0) {
      const roleId = systemAdminRole[0].id;

      // Delete system admin user(s) with global tenant ID
      await queryRunner.query(
        `DELETE FROM users WHERE role_id = $1 AND tenant_id = $2`,
        [roleId, GLOBAL_SYSTEM_TENANT_ID]
      );
    }
  }
}

