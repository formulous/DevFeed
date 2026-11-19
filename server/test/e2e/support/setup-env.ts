import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..', '..', '..');
const testEnv = join(root, '.env.test');
config({ path: existsSync(testEnv) ? testEnv : join(root, '.env'), quiet: true });
process.env.CRAWL_SCHEDULER_ENABLED = 'false';
process.env.SEARCH_CACHE_ENABLED = 'false';
process.env.RATE_LIMIT_ENABLED = 'false';

if (process.env.DB_DATABASE !== 'devfeed_test') {
  throw new Error(`e2e는 devfeed_test에서만 실행함 (현재 DB_DATABASE=${process.env.DB_DATABASE ?? '(없음)'})`);
}
