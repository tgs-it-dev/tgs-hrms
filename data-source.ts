// data-source.ts  (root level)
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Company } from './src/entities/company.entity';
import { Department } from './src/entities/department.entity';
import { Designation } from 'src/entities/designation.entity';
import * as dotenv from 'dotenv';
dotenv.config();          // ← so .env values work

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  entities: [Company, Department , Designation],            // or 'src/entities/**/*.ts'
  migrations: ['src/migrations/**/*.ts'],
  synchronize: false,                         // never true when using migrations
  logging: false,
});
