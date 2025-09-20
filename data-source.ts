// import 'reflect-metadata';
// import { DataSource } from 'typeorm';
// import { Tenant } from './src/entities/tenant.entity';
// import { User } from './src/entities/user.entity';
// import { Role } from './src/entities/role.entity';
// import { Permission } from './src/entities/permission.entity';
// import { RolePermission } from './src/entities/role-permission.entity';
// import { Department } from './src/entities/department.entity';
// import { Designation } from './src/entities/designation.entity';
// import { Employee } from './src/entities/employee.entity';
// import { Attendance } from './src/entities/attendance.entity';
// import { Timesheet } from './src/entities/timesheet.entity';
// import { Leave } from './src/entities/leave.entity';
// import { Team } from './src/entities/team.entity';
// import { SignupSession } from './src/entities/signup-session.entity';
// import { CompanyDetails } from './src/entities/company-details.entity';
// import { SubscriptionPlan } from './src/entities/subscription-plan.entity';
// import * as dotenv from 'dotenv';
// dotenv.config(); 

// export const AppDataSource = new DataSource({
//   type: 'postgres',
//   host: process.env.DB_HOST,
//   port: parseInt(process.env.DB_PORT || '5432', 10),
//   username: process.env.DB_USER,
//   password: process.env.DB_PASS,
//   database: process.env.DB_NAME,
//   entities: [Tenant, User, Role, Permission, RolePermission, Department, Designation, Employee, Attendance, Timesheet, Leave, Team, SignupSession, CompanyDetails, SubscriptionPlan],
//   migrations: ['src/migrations/**/*.ts'],
//   synchronize: false,
//   logging: true,  
// });








import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  entities: [__dirname + '/src/entities/*.entity{.ts,.js}'], // ✅ safer for both dev & prod
  migrations: [__dirname + '/src/migrations/*{.ts,.js}'],
  synchronize: false, // ✅ never true in prod
  logging: process.env.NODE_ENV !== 'production',
});
