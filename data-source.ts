import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Tenant } from './src/entities/tenant.entity';
import { User } from './src/entities/user.entity';
import { Role } from './src/entities/role.entity';
import { Permission } from './src/entities/permission.entity';
import { RolePermission } from './src/entities/role-permission.entity';
import { Department } from './src/entities/department.entity';
import { Designation } from './src/entities/designation.entity';
import { Employee } from './src/entities/employee.entity';
import * as dotenv from 'dotenv';
dotenv.config(); // Load environment variables

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  entities: [Tenant, User, Role, Permission, RolePermission, Department, Designation, Employee],
  migrations: ['src/migrations/**/*.ts'],
  synchronize: false,
  logging: true,  // Set logging to true for debugging
});
