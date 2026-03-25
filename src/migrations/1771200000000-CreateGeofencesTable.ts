import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGeofencesTable1771200000000 implements MigrationInterface {
  name = 'CreateGeofencesTable1771200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS geofences (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id uuid NOT NULL,
        team_id uuid NOT NULL,
        name varchar(120) NOT NULL,
        description text NULL,
        latitude numeric(10,7) NOT NULL,
        longitude numeric(10,7) NOT NULL,
        status varchar(10) NOT NULL DEFAULT 'active',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_geofences_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT,
        CONSTRAINT fk_geofences_team_id FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
        CONSTRAINT uq_geofences_tenant_team_name UNIQUE (tenant_id, team_id, name)
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_geofences_tenant_id ON geofences(tenant_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_geofences_team_id ON geofences(team_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_geofences_name ON geofences(name);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_geofences_status ON geofences(status);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS geofences;`);
  }
}

