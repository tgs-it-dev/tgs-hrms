import { TypeOrmModuleOptions } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";

export const typeOrmConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  const isProduction = configService.get("NODE_ENV") === "production";

  return {
    type: "postgres",
    host: configService.get("DB_HOST"),
    port: +configService.get("DB_PORT"),
    username: configService.get("DB_USER"),
    password: configService.get("DB_PASS"),
    database: configService.get("DB_NAME"),
    synchronize: false,
    entities: [__dirname + "/../entities/*.entity.{ts,js}"],
    ...(isProduction && {
      ssl: {
        rejectUnauthorized: false,
      },
    }),
  };
};
