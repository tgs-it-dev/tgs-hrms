import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

export const typeOrmConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: configService.get('DB_HOST'),
  port: +configService.get('DB_PORT'),
  username: configService.get('DB_USER'),
  password: configService.get('DB_PASS'),
  database: configService.get('DB_NAME'),
  synchronize: false, // Disabled to prevent schema sync issues

  // ✅ Automatically load all entities from src/entities folder
  entities: [__dirname + '/../entities/*.entity.{ts,js}'],

  // ❗️Optional: If you want autoLoadEntities also
  // autoLoadEntities: true,
});
