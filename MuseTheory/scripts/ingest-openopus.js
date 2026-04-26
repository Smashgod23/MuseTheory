#!/usr/bin/env node
/**
 * Ingests classical music works from Open Opus and enriches them with
 * IMSLP sheet music links, then writes them into the pieces table.
 *
 * Usage:
 *   cd MuseTheory/scripts
 *   npm install
 *   node ingest-openopus.js            # full run with IMSLP lookup
 *   node ingest-openopus.js --skip-imslp  # faster, no IMSLP requests
 *
 * DB credentials are read from ../.env (same file the backend uses).
 */

require('dotenv').config({ path: '../.env' });
const https = require('https');
const { Pool } = require('pg');
const { randomUUID } = require('crypto');

// ── Config ─────────────────────────────────────────────────────────────────

const SKIP_IMSLP = process.argv.includes('--skip-imslp');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'musetheory',
  user: process.env.DB_USERNAME || 'musetheory',
  password: process.env.DB_PASSWORD || 'musetheory',
});

const OPENOPUS_BASE = 'https://api.openopus.org';
const IMSLP_API = 'https://imslp.org/api.php';

// Open Opus rate limit is generous; IMSLP asks for polite crawling.
const OPENOPUS_DELAY_MS = 150;
const IMSLP_DELAY_MS = 700;

// Maps Open Opus genre labels to the ensemble_type values the app uses.
const GENRE_TO_ENSEMBLE = {
  'Orchestral': 'orchestra',
  'Chamber Music': 'chamber',
  'Choral': 'choir',
  'Keyboard': 'solo',
  'Vocal': 'solo',
  'Stage': 'orchestra',
};

// ── Helpers ─────────────────────────────────────────────────────────────────

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
            reject(new Error(`Non-JSON response from ${url}: ${body.slice(0, 80)}`));
          }
        });
      }
    );
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${url}`));
    });
    req.on('error', reject);
  });
}

// ── Open Opus ────────────────────────────────────────────────────────────────

async function getRecommendedComposers() {
  const data = await fetchJSON(`${OPENOPUS_BASE}/composer/list/rec.json`);
  if (!data.composers) throw new Error('Unexpected Open Opus response: ' + JSON.stringify(data).slice(0, 100));
  return data.composers;
}

async function getWorksForComposer(composerId) {
  const data = await fetchJSON(`${OPENOPUS_BASE}/work/list/composer/${composerId}/all.json`);
  // Open Opus returns { status: { success: 'false', ... }, works: null } when a composer has no works
  return Array.isArray(data.works) ? data.works : [];
}

// ── IMSLP ────────────────────────────────────────────────────────────────────

async function findImslpUrl(workTitle, composerFullName) {
  // Search for "<work title> <composer last name>" to narrow results.
  const lastName = composerFullName.split(',')[0].trim();
  const query = encodeURIComponent(`${workTitle} ${lastName}`);
  const url = `${IMSLP_API}?action=query&list=search&srsearch=${query}&srnamespace=0&srlimit=1&format=json`;

  try {
    const data = await fetchJSON(url, 10000);
    const hits = data?.query?.search || [];
    if (hits.length === 0) return null;

    // IMSLP page titles look like "Symphony No. 5, Op. 67 (Beethoven, Ludwig van)"
    // The canonical URL is https://imslp.org/wiki/<title_with_underscores>
    const pageTitle = hits[0].title;
    return `https://imslp.org/wiki/${encodeURIComponent(pageTitle.replace(/ /g, '_'))}`;
  } catch {
    // IMSLP is unreliable; treat any failure as "not found"
    return null;
  }
}

// ── Database ─────────────────────────────────────────────────────────────────

async function pieceExists(title, composer) {
  const res = await pool.query(
    `SELECT 1 FROM pieces WHERE LOWER(title) = LOWER($1) AND LOWER(composer) = LOWER($2) LIMIT 1`,
    [title, composer]
  );
  return res.rowCount > 0;
}

async function insertPiece({ title, alternateTitle, composer, genre, ensembleType, era, sheetMusicUrl }) {
  await pool.query(
    `INSERT INTO pieces
       (id, title, alternate_title, composer, genre, difficulty_level,
        ensemble_type, era, sheet_music_url, source_reference, score_url, midi_ref_url)
     VALUES ($1, $2, $3, $4, $5, NULL, $6, $7, $8, 'Open Opus', NULL, NULL)`,
    [
      randomUUID(),
      title,
      alternateTitle || null,
      composer,
      genre,
      ensembleType || null,
      era || null,
      sheetMusicUrl || null,
    ]
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Connecting to database...');
  await pool.query('SELECT 1'); // fail fast if creds are wrong

  console.log(`Fetching recommended composers from Open Opus...`);
  const composers = await getRecommendedComposers();
  console.log(`Found ${composers.length} composers.\n`);

  if (SKIP_IMSLP) {
    console.log('--skip-imslp: IMSLP lookups disabled. Sheet music URLs will be null.\n');
  }

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const composer of composers) {
    console.log(`▸ ${composer.complete_name} (${composer.epoch})`);
    await sleep(OPENOPUS_DELAY_MS);

    let works;
    try {
      works = await getWorksForComposer(composer.id);
    } catch (e) {
      console.warn(`  ! Failed to fetch works: ${e.message}`);
      errors++;
      continue;
    }

    // Limit to popular or recommended works so the library stays curated.
    // "All works" for prolific composers like Bach is 500+ entries.
    const toIngest = works.filter((w) => w.popular === '1' || w.recommended === '1');
    console.log(`  ${toIngest.length} popular/recommended works (${works.length} total)`);

    for (const work of toIngest) {
      const title = work.title.trim();
      const composerName = composer.complete_name;

      try {
        if (await pieceExists(title, composerName)) {
          skipped++;
          continue;
        }

        let sheetMusicUrl = null;
        if (!SKIP_IMSLP) {
          await sleep(IMSLP_DELAY_MS);
          sheetMusicUrl = await findImslpUrl(title, composerName);
        }

        await insertPiece({
          title,
          alternateTitle: work.subtitle?.trim() || null,
          composer: composerName,
          genre: work.genre,
          ensembleType: GENRE_TO_ENSEMBLE[work.genre] || null,
          era: composer.epoch?.toLowerCase() || null,
          sheetMusicUrl,
        });

        inserted++;
        const tag = sheetMusicUrl ? '+ IMSLP' : SKIP_IMSLP ? '' : 'no IMSLP';
        console.log(`  [+] ${title}${tag ? ` (${tag})` : ''}`);
      } catch (e) {
        errors++;
        console.warn(`  [!] ${title}: ${e.message}`);
      }
    }
  }

  console.log('\n─────────────────────────────────────────');
  console.log(`Done.`);
  console.log(`  Inserted : ${inserted}`);
  console.log(`  Skipped  : ${skipped} (already in DB)`);
  console.log(`  Errors   : ${errors}`);
  console.log('─────────────────────────────────────────');

  await pool.end();
}

main().catch((e) => {
  console.error('\nFatal error:', e.message);
  process.exit(1);
});
