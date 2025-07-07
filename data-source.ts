import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Company } from './src/entities/company.entity';
import { Department } from './src/entities/department.entity';
import { User } from './src/entities/user.entity';
import * as dotenv from 'dotenv';

dotenv.config(); // Load environment variables

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  entities: [Company, Department, User],  // Ensure all entities are listed correctly
  migrations: ['src/migrations/**/*.ts'],
  synchronize: false,
  logging: true,  // Set logging to true for debugging
});
