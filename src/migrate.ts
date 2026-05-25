import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  entities: [__dirname + '/entities/*.entity.{ts,js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
  logging: !isProduction,
  ...(isProduction && {
    ssl: { rejectUnauthorized: false },
  }),
});

AppDataSource.initialize()
  .then(async (ds) => {
    console.log('Running migrations...');
    const migrations = await ds.runMigrations({ transaction: 'each' });
    if (migrations.length === 0) {
      console.log('No pending migrations.');
    } else {
      console.log(
        `Applied ${migrations.length} migration(s):`,
        migrations.map((m) => m.name),
      );
    }
    await ds.destroy();
    process.exit(0);
  })
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
