import type { DataSourceOptions } from 'typeorm';
import type { AppEnv } from '../../config/env';
import { ENTITIES } from '../../entities';

export function buildDataSourceOptions(env: AppEnv): DataSourceOptions {
  return {
    type: 'mariadb',
    connectorPackage: 'mysql2',
    host: env.db.host,
    port: env.db.port,
    username: env.db.username,
    password: env.db.password,
    database: env.db.database,
    charset: 'utf8mb4_unicode_ci',
    timezone: 'Z',
    dateStrings: false,
    supportBigNumbers: true,
    bigNumberStrings: false,
    flags: ['-FOUND_ROWS'],
    synchronize: false,
    migrationsRun: false,
    entities: ENTITIES,
    poolSize: 10,
  };
}
