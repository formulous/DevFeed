import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from '../common/database/data-source-options';
import { applyUtcSession } from '../common/database/database.module';
import { loadEnv } from '../config/env';

export async function openScriptContext() {
  config({ path: '.env', quiet: true });
  const env = loadEnv(process.env);
  const dataSource = await new DataSource(buildDataSourceOptions(env)).initialize();
  await applyUtcSession(dataSource);
  return { env, dataSource };
}

export function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const match = /^--([\w-]+)(?:=(.*))?$/.exec(argv[i]);
    if (!match) continue;
    args[match[1]] = match[2] ?? argv[++i] ?? '';
  }
  return args;
}
