#!/usr/bin/env node
/**
 * Adds IMSLP sheet music URLs to pieces that don't have one yet.
 * Safe to run multiple times - only touches rows where sheet_music_url IS NULL.
 *
 * Usage:
 *   cd MuseTheory/scripts
 *   node enrich-imslp.js
 *
 * Expects the same ../.env DB config as ingest-openopus.js.
 * Takes roughly 1-2 seconds per piece due to IMSLP rate limiting.
 */

require('dotenv').config({ path: '../.env' });
const https = require('https');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'musetheory',
  user: process.env.DB_USERNAME || 'musetheory',
  password: process.env.DB_PASSWORD || 'musetheory',
});

const IMSLP_API = 'https://imslp.org/api.php';
const IMSLP_DELAY_MS = 700;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function fetchJSON(url, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers: { 'User-Agent': 'MuseTheory-Ingest/1.0 (educational project)' } },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch {
            reject(new Error('Non-JSON from IMSLP'));
          }
        });
      }
    );
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('Timeout')); });
    req.on('error', reject);
  });
}

async function findImslpUrl(workTitle, composerFullName) {
  const lastName = composerFullName.split(',')[0].trim();
  const query = encodeURIComponent(`${workTitle} ${lastName}`);
  const url = `${IMSLP_API}?action=query&list=search&srsearch=${query}&srnamespace=0&srlimit=1&format=json`;

  try {
    const data = await fetchJSON(url);
    const hits = data?.query?.search || [];
    if (hits.length === 0) return null;
    const pageTitle = hits[0].title;
    return `https://imslp.org/wiki/${encodeURIComponent(pageTitle.replace(/ /g, '_'))}`;
  } catch {
    return null;
  }
}

async function main() {
  console.log('Connecting to database...');
  await pool.query('SELECT 1');

  const { rows } = await pool.query(
    `SELECT id, title, composer FROM pieces WHERE sheet_music_url IS NULL ORDER BY composer, title`
  );
  console.log(`Found ${rows.length} pieces without a sheet music URL.\n`);

  if (rows.length === 0) {
    console.log('Nothing to do.');
    await pool.end();
    return;
  }

  let updated = 0;
  let notFound = 0;
  let errors = 0;

  for (let i = 0; i < rows.length; i++) {
    const { id, title, composer } = rows[i];
    process.stdout.write(`[${i + 1}/${rows.length}] ${title} — `);
    await sleep(IMSLP_DELAY_MS);

    try {
      const url = await findImslpUrl(title, composer || '');
      if (url) {
        await pool.query('UPDATE pieces SET sheet_music_url = $1 WHERE id = $2', [url, id]);
        console.log('found');
        updated++;
      } else {
        console.log('not on IMSLP');
        notFound++;
      }
    } catch (e) {
      console.log('error:', e.message);
      errors++;
    }
  }

  console.log('\n─────────────────────────────────────────');
  console.log(`Done.`);
  console.log(`  Updated  : ${updated}`);
  console.log(`  Not found: ${notFound}`);
  console.log(`  Errors   : ${errors}`);
  console.log('─────────────────────────────────────────');

  await pool.end();
}

main().catch((e) => {
  console.error('\nFatal error:', e.message);
  process.exit(1);
});
