import { Logger, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { APP_ENV, AppEnv } from '../../config/env';
import { buildDataSourceOptions } from './data-source-options';

const logger = new Logger('Database');

export async function applyUtcSession(dataSource: DataSource): Promise<void> {
  const pool = (dataSource.driver as unknown as { pool?: { on: Function } }).pool;
  pool?.on('connection', (connection: { query: (sql: string) => void }) => {
    connection.query("SET time_zone = '+00:00'");
  });
  const [row] = (await dataSource.query(
    'SELECT TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), NOW()) AS diff',
  )) as { diff: number | string }[];
  if (Number(row?.diff) !== 0) {
    logger.warn(`DB 세션 시간대가 UTC가 아님 (차이 ${row?.diff}초). DB 기본값 시각이 어긋날 수 있음`);
  }
}

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [APP_ENV],
      useFactory: (env: AppEnv) => buildDataSourceOptions(env),
      dataSourceFactory: async (options) => {
        const dataSource = await new DataSource(options!).initialize();
        await applyUtcSession(dataSource);
        return dataSource;
      },
    }),
  ],
})
export class DatabaseModule {}
