import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "5432", 10),
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  entities: [__dirname + '/src/entities/*.entity{.ts,.js}'], // ✅ safer for both dev & prod
  migrations: [
    __dirname + '/src/migrations/*{.ts,.js}',
    __dirname + '/**/migrations/*.js'
  ],
  synchronize: false, // ✅ never true in prod
  logging: process.env.NODE_ENV !== 'production',
});
