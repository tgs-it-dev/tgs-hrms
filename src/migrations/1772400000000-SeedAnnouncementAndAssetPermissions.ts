import { MigrationInterface, QueryRunner } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

/**
 * Seeds Announcement and Asset (incl. Asset Request) permissions role-wise:
 *
 * Announcements:
 * - Admin, System-Admin: same as HR Admin (create, read, update, delete, send).
 *   System-Admin can manage announcements across all tenants (app logic by role).
 * - HR Admin: already has in config; ensure DB has them for consistency.
 *
 * Assets & Asset Requests:
 * - Employee: request assets (asset-request.create), view own requests (asset-request.read).
 * - Manager: same as Employee + view team members' requests (asset-request.create, asset-request.read; team scope in app).
 * - Admin: asset CRUD + assign/unassign; view all requests; approve/reject (asset.*, asset-request.read, approve, reject).
 * - System-Admin: same as Admin + manage all tenants' assets (app logic by role).
 */
export class SeedAnnouncementAndAssetPermissions1772400000000 implements MigrationInterface {
  name = 'SeedAnnouncementAndAssetPermissions1772400000000';

  private readonly announcementPerms: { name: string; description: string }[] = [
    { name: 'announcement.create', description: 'Create announcements' },
    { name: 'announcement.read', description: 'View announcements' },
    { name: 'announcement.update', description: 'Update announcements' },
    { name: 'announcement.delete', description: 'Delete announcements' },
    { name: 'announcement.send', description: 'Send announcement emails' },
  ];

  private readonly assetPerms: { name: string; description: string }[] = [
    { name: 'asset.create', description: 'Create assets' },
    { name: 'asset.read', description: 'View asset information' },
    { name: 'asset.update', description: 'Update assets' },
    { name: 'asset.delete', description: 'Delete assets' },
    { name: 'asset.assign', description: 'Assign assets to employees' },
    { name: 'asset.unassign', description: 'Unassign assets from employees' },
  ];

  private readonly assetRequestPerms: { name: string; description: string }[] = [
    { name: 'asset-request.create', description: 'Create asset requests' },
    { name: 'asset-request.read', description: 'View asset request information' },
    { name: 'asset-request.update', description: 'Update asset requests' },
    { name: 'asset-request.delete', description: 'Delete asset requests' },
    { name: 'asset-request.approve', description: 'Approve asset requests' },
    { name: 'asset-request.reject', description: 'Reject asset requests' },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    const allPerms = [
      ...this.announcementPerms,
      ...this.assetPerms,
      ...this.assetRequestPerms,
    ];

    for (const p of allPerms) {
      await queryRunner.query(
        `INSERT INTO permissions (id, name, description)
         VALUES ($1, $2, $3)
         ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description`,
        [uuidv4(), p.name, p.description],
      );
    }

    const getRoleId = async (roleName: string): Promise<string | null> => {
      const rows = await queryRunner.query(
        `SELECT id FROM roles WHERE LOWER(name) = LOWER($1) LIMIT 1`,
        [roleName],
      );
      return rows.length ? rows[0].id : null;
    };

    const getPermId = async (permName: string): Promise<string | null> => {
      const rows = await queryRunner.query(
        `SELECT id FROM permissions WHERE name = $1 LIMIT 1`,
        [permName],
      );
      return rows.length ? rows[0].id : null;
    };

    const grant = async (roleId: string, permId: string) => {
      const existing = await queryRunner.query(
        `SELECT id FROM role_permissions WHERE role_id = $1 AND permission_id = $2`,
        [roleId, permId],
      );
      if (existing.length === 0) {
        await queryRunner.query(
          `INSERT INTO role_permissions (id, role_id, permission_id) VALUES ($1, $2, $3)`,
          [uuidv4(), roleId, permId],
        );
      }
    };

    const grantPermsToRole = async (roleName: string, permNames: string[]) => {
      const roleId = await getRoleId(roleName);
      if (!roleId) return;
      for (const name of permNames) {
        const permId = await getPermId(name);
        if (permId) await grant(roleId, permId);
      }
    };

    // ——— Announcements: Admin & System-Admin (same as HR Admin); HR Admin for consistency
    const announcementNames = this.announcementPerms.map((p) => p.name);
    await grantPermsToRole('admin', announcementNames);
    await grantPermsToRole('system-admin', announcementNames);
    await grantPermsToRole('hr-admin', announcementNames);

    // ——— Asset Requests: Employee & Manager (request + view own / team)
    await grantPermsToRole('employee', ['asset-request.create', 'asset-request.read']);
    await grantPermsToRole('manager', ['asset-request.create', 'asset-request.read']);

    // ——— Assets + Asset Request approve/reject: Admin & System-Admin
    const adminAssetPerms = [
      ...this.assetPerms.map((p) => p.name),
      'asset-request.read',
      'asset-request.approve',
      'asset-request.reject',
    ];
    await grantPermsToRole('admin', adminAssetPerms);
    await grantPermsToRole('system-admin', adminAssetPerms);

    // HR Admin: allow asset create and view/approve/reject requests (existing controller behaviour)
    await grantPermsToRole('hr-admin', [
      'asset.create',
      'asset.read',
      'asset-request.read',
      'asset-request.approve',
      'asset-request.reject',
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const getRoleId = async (roleName: string): Promise<string | null> => {
      const rows = await queryRunner.query(
        `SELECT id FROM roles WHERE LOWER(name) = LOWER($1) LIMIT 1`,
        [roleName],
      );
      return rows.length ? rows[0].id : null;
    };

    const getPermId = async (permName: string): Promise<string | null> => {
      const rows = await queryRunner.query(
        `SELECT id FROM permissions WHERE name = $1 LIMIT 1`,
        [permName],
      );
      return rows.length ? rows[0].id : null;
    };

    const revoke = async (roleId: string, permId: string) => {
      await queryRunner.query(
        `DELETE FROM role_permissions WHERE role_id = $1 AND permission_id = $2`,
        [roleId, permId],
      );
    };

    const revokePermsFromRole = async (roleName: string, permNames: string[]) => {
      const roleId = await getRoleId(roleName);
      if (!roleId) return;
      for (const name of permNames) {
        const permId = await getPermId(name);
        if (permId) await revoke(roleId, permId);
      }
    };

    const announcementNames = this.announcementPerms.map((p) => p.name);
    await revokePermsFromRole('admin', announcementNames);
    await revokePermsFromRole('system-admin', announcementNames);
    await revokePermsFromRole('hr-admin', announcementNames);

    await revokePermsFromRole('employee', ['asset-request.create', 'asset-request.read']);
    await revokePermsFromRole('manager', ['asset-request.create', 'asset-request.read']);

    const adminAssetPerms = [
      ...this.assetPerms.map((p) => p.name),
      'asset-request.read',
      'asset-request.approve',
      'asset-request.reject',
    ];
    await revokePermsFromRole('admin', adminAssetPerms);
    await revokePermsFromRole('system-admin', adminAssetPerms);

    await revokePermsFromRole('hr-admin', [
      'asset.create',
      'asset.read',
      'asset-request.read',
      'asset-request.approve',
      'asset-request.reject',
    ]);
  }
}
