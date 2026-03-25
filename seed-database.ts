import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { seedRolesAndPermissions } from './src/common/seeders/seed-roles-and-permissions';
import { Logger } from '@nestjs/common';

// Load environment variables
config();

const logger = new Logger('DatabaseSeeder');

async function runSeeder() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || 'password',
    database: process.env.DB_NAME || 'tgs_hrms',
    entities: ['src/**/*.entity.ts'],
    migrations: ['src/migrations/*.ts'],
    synchronize: false,
    logging: true,
  });

  try {
    await dataSource.initialize();
    logger.log('Database connection established');
    
    await seedRolesAndPermissions(dataSource);
    logger.log('Seeding completed successfully');
  } catch (error) {
    logger.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
    logger.log('Database connection closed');
  }
}

runSeeder();
