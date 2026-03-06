/**
 * Clean database: drop all tables in the public schema (Aurora/PostgreSQL).
 * Drops the public schema and recreates it so migration:run can run from scratch.
 *
 * Run: npm run db:clean
 * Then: npm run migration:run
 */
import 'reflect-metadata';
import { config } from 'dotenv';
import { AppDataSource } from '../data-source';

config();

async function clean() {
  await AppDataSource.initialize();

  await AppDataSource.query(`DROP SCHEMA IF EXISTS public CASCADE`);
  await AppDataSource.query(`CREATE SCHEMA public`);
  await AppDataSource.query(`GRANT ALL ON SCHEMA public TO public`);

  console.log('Database cleaned: all tables dropped. Run npm run migration:run next.');
  await AppDataSource.destroy();
  process.exit(0);
}

clean().catch((err) => {
  console.error(err);
  process.exit(1);
});
