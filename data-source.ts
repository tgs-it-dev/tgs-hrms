import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get root directory (works for both dev and prod)
// process.cwd() always returns the project root directory
const rootDir = process.cwd();

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "5432", 10),
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  entities: [__dirname + '/src/entities/*.entity{.ts,.js}'], // ✅ safer for both dev & prod
  migrations: [
    // Always use root directory to find migrations in src/migrations
    // This works in both development (from root) and production (from dist)
    // process.cwd() always returns project root, so src/migrations will be found correctly
    rootDir + '/src/migrations/*{.ts,.js}',
    rootDir + '/src/migrations/*.ts',
    rootDir + '/src/migrations/*.js'
  ],
  synchronize: false, // ✅ never true in prod
  logging: process.env.NODE_ENV !== 'production',
});
