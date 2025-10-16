import { MigrationInterface, QueryRunner } from "typeorm";
import { v4 as uuidv4 } from "uuid";

export class AddManageCompanyPermission1759164300000 implements MigrationInterface {
    name = 'AddManageCompanyPermission1759164300000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add the manage_company permission
        await queryRunner.query(`
            INSERT INTO permissions (id, name, description) 
            VALUES ($1, $2, $3) 
            ON CONFLICT (name) DO NOTHING;
        `, [uuidv4(), 'manage_company', 'manage company details']);

        // Get role and permission IDs
        const adminRole = await queryRunner.query(`SELECT id FROM roles WHERE name = 'Admin'`);
        const systemAdminRole = await queryRunner.query(`SELECT id FROM roles WHERE name = 'System-Admin'`);
        const manageCompanyPermission = await queryRunner.query(`SELECT id FROM permissions WHERE name = 'manage_company'`);

        if (adminRole.length > 0 && manageCompanyPermission.length > 0) {
            // Check if permission already exists for Admin role
            const existingAdminPermission = await queryRunner.query(`
                SELECT id FROM role_permissions 
                WHERE role_id = $1 AND permission_id = $2
            `, [adminRole[0].id, manageCompanyPermission[0].id]);

            if (existingAdminPermission.length === 0) {
                // Add permission to Admin role
                await queryRunner.query(`
                    INSERT INTO role_permissions (id, role_id, permission_id) 
                    VALUES ($1, $2, $3);
                `, [uuidv4(), adminRole[0].id, manageCompanyPermission[0].id]);
            }
        }

        if (systemAdminRole.length > 0 && manageCompanyPermission.length > 0) {
            // Check if permission already exists for System-Admin role
            const existingSystemAdminPermission = await queryRunner.query(`
                SELECT id FROM role_permissions 
                WHERE role_id = $1 AND permission_id = $2
            `, [systemAdminRole[0].id, manageCompanyPermission[0].id]);

            if (existingSystemAdminPermission.length === 0) {
                // Add permission to System-Admin role
                await queryRunner.query(`
                    INSERT INTO role_permissions (id, role_id, permission_id) 
                    VALUES ($1, $2, $3);
                `, [uuidv4(), systemAdminRole[0].id, manageCompanyPermission[0].id]);
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove the permission from role_permissions
        await queryRunner.query(`
            DELETE FROM role_permissions 
            WHERE permission_id IN (SELECT id FROM permissions WHERE name = 'manage_company')
        `);
        
        // Remove the permission
        await queryRunner.query(`DELETE FROM permissions WHERE name = 'manage_company'`);
    }
}
