const path = require('path');

const root = path.join(__dirname, '..');
const req = (m) => require(path.join(root, 'node_modules', m));

async function openDb(database) {
  process.env.DB_DATABASE = database;
  req('reflect-metadata');
  req('dotenv').config({ path: path.join(root, '.env'), quiet: true });
  const { DataSource } = req('typeorm');
  const { buildDataSourceOptions } = require(path.join(root, 'dist/common/database/data-source-options'));
  const { loadEnv } = require(path.join(root, 'dist/config/env'));
  const env = loadEnv(process.env);
  const ds = await new DataSource(buildDataSourceOptions(env)).initialize();
  const [{ name }] = await ds.query('SELECT DATABASE() AS name');
  if (name !== database) {
    await ds.destroy();
    throw new Error(`대상 DB가 ${database}가 아님: ${name}`);
  }
  return { ds, env, root };
}

function pct(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

module.exports = { openDb, pct, root };
