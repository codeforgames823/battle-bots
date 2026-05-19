// One-time DB initialization. Run with `npm run init-db`.
// Uses DATABASE_URL or PG* env vars (see .env.example).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const url = process.env.DATABASE_URL || '';
const isLocal = url.includes('localhost');

const pool = new pg.Pool({
  connectionString: url || undefined,
  ssl: isLocal ? false : (url || process.env.PGSSL === 'true') ? { rejectUnauthorized: false } : false,
});

const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

(async () => {
  try {
    await pool.query(sql);
    console.log('Schema applied successfully.');
  } catch (e) {
    console.error('Schema apply failed:', e);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
