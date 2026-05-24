#!/usr/bin/env node
/**
 * Curated cross-genre repertoire ingest.
 *
 * The Open Opus ingest covers classical works. This script adds the rest:
 * jazz standards, musical theater, sacred/choral, wind & marching band,
 * brass/woodwind chamber, percussion, world/folk, and solo repertoire
 * organized per instrument and voice part.
 *
 * Sources used (all public domain repertoire metadata, not sheet music
 * content): TMEA / NYSSMA / FBA prescribed music lists, RCM and ABRSM
 * exam syllabi, Suzuki method volumes, the Real Book / Real Vocal Book
 * canonical jazz standards, standard wind ensemble literature, classical
 * guitar canon, and the SATB sacred anthem canon. Titles and composers
 * are factual data; nothing copyrighted is reproduced.
 *
 * Usage:
 *   cd MuseTheory/scripts
 *   node ingest-curated.js
 *
 * Idempotent: skips rows that already exist by (title, composer).
 */

require('dotenv').config({ path: '../.env' });
const { Pool } = require('pg');
const { randomUUID } = require('crypto');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'musetheory',
  user: process.env.DB_USERNAME || 'musetheory',
  password: process.env.DB_PASSWORD || 'musetheory',
});

// ── Curated repertoire ──────────────────────────────────────────────────────
//
// Compact row shape:
//   t   title
//   alt alternate title
//   c   composer
//   ar  arranger
//   g   genre
//   e   ensemble_type (vocal, choir, voice, opera, orchestra, chamber,
//                      band, solo)
//   era (baroque, classical, romantic, modern, contemporary, jazz,
//        musical theater, sacred, folk, popular)
//   d   difficulty_level (1-10, optional)
//   ins instrumentation
//   k   musical_key
//   l   language
//   p   purpose
//   n   performance_notes
//   src source_reference

const JAZZ_STANDARDS = [
  { t: 'Autumn Leaves',        c: 'Joseph Kosma',                   ar: 'Johnny Mercer (lyrics)', g: 'jazz', e: 'chamber', era: 'jazz', d: 4, l: 'English', src: 'Real Book' },
  { t: 'All The Things You Are', c: 'Jerome Kern',                  ar: 'Oscar Hammerstein II',   g: 'jazz', e: 'chamber', era: 'jazz', d: 6, src: 'Real Book' },
  { t: 'Body and Soul',        c: 'Johnny Green',                    g: 'jazz', e: 'chamber', era: 'jazz', d: 6, src: 'Real Book' },
  { t: 'Take Five',            c: 'Paul Desmond',                    g: 'jazz', e: 'chamber', era: 'jazz', d: 5, k: 'Eb minor', src: 'Real Book' },
  { t: 'So What',              c: 'Miles Davis',                     g: 'jazz', e: 'chamber', era: 'jazz', d: 5, k: 'D dorian', src: 'Real Book' },
  { t: 'Blue in Green',        c: 'Miles Davis',                     g: 'jazz', e: 'chamber', era: 'jazz', d: 5, src: 'Real Book' },
  { t: 'Freddie Freeloader',   c: 'Miles Davis',                     g: 'jazz', e: 'chamber', era: 'jazz', d: 4, src: 'Real Book' },
  { t: 'All Blues',            c: 'Miles Davis',                     g: 'jazz', e: 'chamber', era: 'jazz', d: 4, src: 'Real Book' },
  { t: 'Giant Steps',          c: 'John Coltrane',                   g: 'jazz', e: 'chamber', era: 'jazz', d: 9, src: 'Real Book' },
  { t: 'Naima',                c: 'John Coltrane',                   g: 'jazz', e: 'chamber', era: 'jazz', d: 7, src: 'Real Book' },
  { t: "A Love Supreme",       c: 'John Coltrane',                   g: 'jazz', e: 'chamber', era: 'jazz', d: 8, src: 'Real Book' },
  { t: 'Round Midnight',       c: 'Thelonious Monk',                 g: 'jazz', e: 'chamber', era: 'jazz', d: 7, src: 'Real Book' },
  { t: 'Blue Monk',            c: 'Thelonious Monk',                 g: 'jazz', e: 'chamber', era: 'jazz', d: 4, src: 'Real Book' },
  { t: 'Straight, No Chaser',  c: 'Thelonious Monk',                 g: 'jazz', e: 'chamber', era: 'jazz', d: 5, src: 'Real Book' },
  { t: 'Well You Needn\'t',    c: 'Thelonious Monk',                 g: 'jazz', e: 'chamber', era: 'jazz', d: 6, src: 'Real Book' },
  { t: 'In a Sentimental Mood', c: 'Duke Ellington',                  g: 'jazz', e: 'chamber', era: 'jazz', d: 5, src: 'Real Book' },
  { t: 'Sophisticated Lady',   c: 'Duke Ellington',                   g: 'jazz', e: 'chamber', era: 'jazz', d: 6, src: 'Real Book' },
  { t: 'Caravan',              c: 'Duke Ellington / Juan Tizol',      g: 'jazz', e: 'chamber', era: 'jazz', d: 6, src: 'Real Book' },
  { t: 'Mood Indigo',          c: 'Duke Ellington',                   g: 'jazz', e: 'chamber', era: 'jazz', d: 5, src: 'Real Book' },
  { t: 'Satin Doll',           c: 'Duke Ellington / Billy Strayhorn', g: 'jazz', e: 'chamber', era: 'jazz', d: 4, src: 'Real Book' },
  { t: 'Take the A Train',     c: 'Billy Strayhorn',                  g: 'jazz', e: 'band',    era: 'jazz', d: 5, src: 'Real Book' },
  { t: 'Lush Life',            c: 'Billy Strayhorn',                  g: 'jazz', e: 'chamber', era: 'jazz', d: 8, src: 'Real Book' },
  { t: 'Stella by Starlight',  c: 'Victor Young',                     g: 'jazz', e: 'chamber', era: 'jazz', d: 6, src: 'Real Book' },
  { t: 'My Funny Valentine',   c: 'Richard Rodgers / Lorenz Hart',    g: 'jazz', e: 'chamber', era: 'jazz', d: 5, src: 'Real Book' },
  { t: 'The Girl from Ipanema', c: 'Antônio Carlos Jobim',            g: 'bossa nova', e: 'chamber', era: 'jazz', d: 4, src: 'Real Book' },
  { t: 'Wave',                 c: 'Antônio Carlos Jobim',             g: 'bossa nova', e: 'chamber', era: 'jazz', d: 6, src: 'Real Book' },
  { t: 'Corcovado (Quiet Nights of Quiet Stars)', c: 'Antônio Carlos Jobim', g: 'bossa nova', e: 'chamber', era: 'jazz', d: 5, src: 'Real Book' },
  { t: 'Desafinado',           c: 'Antônio Carlos Jobim',             g: 'bossa nova', e: 'chamber', era: 'jazz', d: 7, src: 'Real Book' },
  { t: 'Black Orpheus (Manhã de Carnaval)', c: 'Luiz Bonfá',          g: 'bossa nova', e: 'chamber', era: 'jazz', d: 5, src: 'Real Book' },
  { t: 'Watermelon Man',       c: 'Herbie Hancock',                   g: 'jazz', e: 'chamber', era: 'jazz', d: 5, src: 'Real Book' },
  { t: 'Cantaloupe Island',    c: 'Herbie Hancock',                   g: 'jazz', e: 'chamber', era: 'jazz', d: 4, src: 'Real Book' },
  { t: 'Maiden Voyage',        c: 'Herbie Hancock',                   g: 'jazz', e: 'chamber', era: 'jazz', d: 6, src: 'Real Book' },
  { t: 'Dolphin Dance',        c: 'Herbie Hancock',                   g: 'jazz', e: 'chamber', era: 'jazz', d: 8, src: 'Real Book' },
  { t: 'Footprints',           c: 'Wayne Shorter',                    g: 'jazz', e: 'chamber', era: 'jazz', d: 6, src: 'Real Book' },
  { t: 'Speak No Evil',        c: 'Wayne Shorter',                    g: 'jazz', e: 'chamber', era: 'jazz', d: 7, src: 'Real Book' },
  { t: 'Nefertiti',            c: 'Wayne Shorter',                    g: 'jazz', e: 'chamber', era: 'jazz', d: 7, src: 'Real Book' },
  { t: 'Confirmation',         c: 'Charlie Parker',                   g: 'jazz', e: 'chamber', era: 'jazz', d: 8, src: 'Real Book' },
  { t: 'Donna Lee',            c: 'Charlie Parker',                   g: 'jazz', e: 'chamber', era: 'jazz', d: 9, src: 'Real Book' },
  { t: 'Anthropology',         c: 'Charlie Parker / Dizzy Gillespie', g: 'jazz', e: 'chamber', era: 'jazz', d: 8, src: 'Real Book' },
  { t: 'Ornithology',          c: 'Charlie Parker',                   g: 'jazz', e: 'chamber', era: 'jazz', d: 8, src: 'Real Book' },
  { t: 'Now\'s the Time',      c: 'Charlie Parker',                   g: 'jazz', e: 'chamber', era: 'jazz', d: 5, src: 'Real Book' },
  { t: 'Salt Peanuts',         c: 'Dizzy Gillespie',                  g: 'jazz', e: 'chamber', era: 'jazz', d: 7, src: 'Real Book' },
  { t: 'A Night in Tunisia',   c: 'Dizzy Gillespie',                  g: 'jazz', e: 'chamber', era: 'jazz', d: 7, src: 'Real Book' },
  { t: 'Manteca',              c: 'Dizzy Gillespie / Chano Pozo',     g: 'latin jazz', e: 'band', era: 'jazz', d: 7, src: 'Real Book' },
  { t: 'Sing, Sing, Sing',     c: 'Louis Prima',                      g: 'swing', e: 'band', era: 'jazz', d: 6, src: 'Standard big band' },
  { t: 'In the Mood',          c: 'Joe Garland',                      g: 'swing', e: 'band', era: 'jazz', d: 5, src: 'Standard big band' },
  { t: 'Moonlight Serenade',   c: 'Glenn Miller',                     g: 'swing', e: 'band', era: 'jazz', d: 4, src: 'Standard big band' },
  { t: 'Birdland',             c: 'Josef Zawinul',                    g: 'jazz fusion', e: 'band', era: 'jazz', d: 7, src: 'Standard big band' },
  { t: 'Spain',                c: 'Chick Corea',                      g: 'jazz fusion', e: 'chamber', era: 'jazz', d: 8, src: 'Real Book' },
  { t: '500 Miles High',       c: 'Chick Corea',                      g: 'jazz fusion', e: 'chamber', era: 'jazz', d: 7, src: 'Real Book' },
  { t: 'Chameleon',            c: 'Herbie Hancock',                   g: 'jazz funk', e: 'chamber', era: 'jazz', d: 6, src: 'Real Book' },
  { t: 'Sidewinder',           c: 'Lee Morgan',                       g: 'hard bop', e: 'chamber', era: 'jazz', d: 6, src: 'Real Book' },
  { t: 'Song for My Father',   c: 'Horace Silver',                    g: 'hard bop', e: 'chamber', era: 'jazz', d: 5, src: 'Real Book' },
  { t: "Doxy",                 c: 'Sonny Rollins',                    g: 'jazz', e: 'chamber', era: 'jazz', d: 5, src: 'Real Book' },
  { t: 'St. Thomas',           c: 'Sonny Rollins',                    g: 'calypso jazz', e: 'chamber', era: 'jazz', d: 5, src: 'Real Book' },
  { t: 'Misty',                c: 'Erroll Garner',                    g: 'jazz', e: 'chamber', era: 'jazz', d: 5, src: 'Real Book' },
  { t: 'Misterioso',           c: 'Thelonious Monk',                  g: 'jazz', e: 'chamber', era: 'jazz', d: 7, src: 'Real Book' },
];

const MUSICAL_THEATER = [
  { t: 'Defying Gravity',          c: 'Stephen Schwartz', g: 'musical theater', e: 'voice', era: 'musical theater', d: 8, l: 'English', n: 'From Wicked; soprano belt aria.', src: 'Broadway canon' },
  { t: 'For Good',                 c: 'Stephen Schwartz', g: 'musical theater', e: 'voice', era: 'musical theater', d: 5, l: 'English', n: 'From Wicked; female duet.', src: 'Broadway canon' },
  { t: 'Popular',                  c: 'Stephen Schwartz', g: 'musical theater', e: 'voice', era: 'musical theater', d: 6, l: 'English', n: 'From Wicked.', src: 'Broadway canon' },
  { t: 'On My Own',                c: 'Claude-Michel Schönberg / Alain Boublil', g: 'musical theater', e: 'voice', era: 'musical theater', d: 6, l: 'English', n: 'From Les Misérables.', src: 'Broadway canon' },
  { t: 'I Dreamed a Dream',        c: 'Claude-Michel Schönberg / Alain Boublil', g: 'musical theater', e: 'voice', era: 'musical theater', d: 6, l: 'English', n: 'From Les Misérables.', src: 'Broadway canon' },
  { t: 'Bring Him Home',           c: 'Claude-Michel Schönberg / Alain Boublil', g: 'musical theater', e: 'voice', era: 'musical theater', d: 8, l: 'English', n: 'From Les Misérables; lyric tenor.', src: 'Broadway canon' },
  { t: 'Empty Chairs at Empty Tables', c: 'Claude-Michel Schönberg', g: 'musical theater', e: 'voice', era: 'musical theater', d: 6, l: 'English', src: 'Broadway canon' },
  { t: 'One Day More',             c: 'Claude-Michel Schönberg', g: 'musical theater', e: 'choir', era: 'musical theater', d: 7, l: 'English', n: 'Ensemble.', src: 'Broadway canon' },
  { t: 'Music of the Night',       c: 'Andrew Lloyd Webber', g: 'musical theater', e: 'voice', era: 'musical theater', d: 7, l: 'English', n: 'From The Phantom of the Opera; baritone.', src: 'Broadway canon' },
  { t: 'All I Ask of You',         c: 'Andrew Lloyd Webber', g: 'musical theater', e: 'voice', era: 'musical theater', d: 6, l: 'English', src: 'Broadway canon' },
  { t: 'Think of Me',              c: 'Andrew Lloyd Webber', g: 'musical theater', e: 'voice', era: 'musical theater', d: 7, l: 'English', n: 'Coloratura soprano.', src: 'Broadway canon' },
  { t: 'Memory',                   c: 'Andrew Lloyd Webber', g: 'musical theater', e: 'voice', era: 'musical theater', d: 6, l: 'English', n: 'From Cats.', src: 'Broadway canon' },
  { t: 'Don\'t Cry for Me Argentina', c: 'Andrew Lloyd Webber', g: 'musical theater', e: 'voice', era: 'musical theater', d: 6, l: 'English', n: 'From Evita.', src: 'Broadway canon' },
  { t: 'Tomorrow',                 c: 'Charles Strouse', g: 'musical theater', e: 'voice', era: 'musical theater', d: 4, l: 'English', n: 'From Annie.', src: 'Broadway canon' },
  { t: 'My Favorite Things',       c: 'Richard Rodgers', ar: 'Oscar Hammerstein II', g: 'musical theater', e: 'voice', era: 'musical theater', d: 4, l: 'English', n: 'From The Sound of Music.', src: 'Broadway canon' },
  { t: 'Climb Ev\'ry Mountain',    c: 'Richard Rodgers', g: 'musical theater', e: 'voice', era: 'musical theater', d: 6, l: 'English', src: 'Broadway canon' },
  { t: 'Edelweiss',                c: 'Richard Rodgers', g: 'musical theater', e: 'voice', era: 'musical theater', d: 3, l: 'English', src: 'Broadway canon' },
  { t: 'Some Enchanted Evening',   c: 'Richard Rodgers', g: 'musical theater', e: 'voice', era: 'musical theater', d: 6, l: 'English', n: 'From South Pacific.', src: 'Broadway canon' },
  { t: 'If I Loved You',           c: 'Richard Rodgers', g: 'musical theater', e: 'voice', era: 'musical theater', d: 6, l: 'English', n: 'From Carousel.', src: 'Broadway canon' },
  { t: 'You\'ll Never Walk Alone', c: 'Richard Rodgers', g: 'musical theater', e: 'voice', era: 'musical theater', d: 6, l: 'English', src: 'Broadway canon' },
  { t: 'Maria',                    c: 'Leonard Bernstein', g: 'musical theater', e: 'voice', era: 'musical theater', d: 6, l: 'English', n: 'From West Side Story.', src: 'Broadway canon' },
  { t: 'Tonight',                  c: 'Leonard Bernstein', g: 'musical theater', e: 'voice', era: 'musical theater', d: 6, l: 'English', src: 'Broadway canon' },
  { t: 'Somewhere',                c: 'Leonard Bernstein', g: 'musical theater', e: 'voice', era: 'musical theater', d: 6, l: 'English', src: 'Broadway canon' },
  { t: 'America',                  c: 'Leonard Bernstein', g: 'musical theater', e: 'choir', era: 'musical theater', d: 6, l: 'English', n: 'From West Side Story; ensemble.', src: 'Broadway canon' },
  { t: 'I Could Have Danced All Night', c: 'Frederick Loewe', g: 'musical theater', e: 'voice', era: 'musical theater', d: 5, l: 'English', n: 'From My Fair Lady.', src: 'Broadway canon' },
  { t: 'On the Street Where You Live', c: 'Frederick Loewe', g: 'musical theater', e: 'voice', era: 'musical theater', d: 5, l: 'English', src: 'Broadway canon' },
  { t: 'Cabaret',                  c: 'John Kander',       g: 'musical theater', e: 'voice', era: 'musical theater', d: 6, l: 'English', src: 'Broadway canon' },
  { t: 'New York, New York',       c: 'John Kander',       g: 'musical theater', e: 'voice', era: 'musical theater', d: 5, l: 'English', src: 'Broadway canon' },
  { t: 'All That Jazz',            c: 'John Kander',       g: 'musical theater', e: 'voice', era: 'musical theater', d: 6, l: 'English', n: 'From Chicago.', src: 'Broadway canon' },
  { t: 'Send in the Clowns',       c: 'Stephen Sondheim',  g: 'musical theater', e: 'voice', era: 'musical theater', d: 6, l: 'English', n: 'From A Little Night Music.', src: 'Broadway canon' },
  { t: 'Being Alive',              c: 'Stephen Sondheim',  g: 'musical theater', e: 'voice', era: 'musical theater', d: 7, l: 'English', n: 'From Company.', src: 'Broadway canon' },
  { t: 'Not While I\'m Around',    c: 'Stephen Sondheim',  g: 'musical theater', e: 'voice', era: 'musical theater', d: 5, l: 'English', n: 'From Sweeney Todd.', src: 'Broadway canon' },
  { t: 'Children Will Listen',     c: 'Stephen Sondheim',  g: 'musical theater', e: 'voice', era: 'musical theater', d: 5, l: 'English', n: 'From Into the Woods.', src: 'Broadway canon' },
  { t: 'Giants in the Sky',        c: 'Stephen Sondheim',  g: 'musical theater', e: 'voice', era: 'musical theater', d: 6, l: 'English', src: 'Broadway canon' },
  { t: 'Waving Through a Window',  c: 'Pasek and Paul',    g: 'musical theater', e: 'voice', era: 'musical theater', d: 6, l: 'English', n: 'From Dear Evan Hansen.', src: 'Broadway canon' },
  { t: 'You Will Be Found',        c: 'Pasek and Paul',    g: 'musical theater', e: 'voice', era: 'musical theater', d: 6, l: 'English', src: 'Broadway canon' },
  { t: 'A Million Dreams',         c: 'Pasek and Paul',    g: 'musical theater', e: 'voice', era: 'musical theater', d: 4, l: 'English', n: 'From The Greatest Showman.', src: 'Broadway canon' },
  { t: 'This Is Me',               c: 'Pasek and Paul',    g: 'musical theater', e: 'voice', era: 'musical theater', d: 6, l: 'English', src: 'Broadway canon' },
  { t: 'Alexander Hamilton',       c: 'Lin-Manuel Miranda', g: 'musical theater', e: 'choir', era: 'musical theater', d: 7, l: 'English', n: 'From Hamilton; rap-driven ensemble.', src: 'Broadway canon' },
  { t: 'My Shot',                  c: 'Lin-Manuel Miranda', g: 'musical theater', e: 'voice', era: 'musical theater', d: 7, l: 'English', src: 'Broadway canon' },
  { t: 'Wait for It',              c: 'Lin-Manuel Miranda', g: 'musical theater', e: 'voice', era: 'musical theater', d: 6, l: 'English', src: 'Broadway canon' },
  { t: 'Burn',                     c: 'Lin-Manuel Miranda', g: 'musical theater', e: 'voice', era: 'musical theater', d: 6, l: 'English', src: 'Broadway canon' },
  { t: 'Satisfied',                c: 'Lin-Manuel Miranda', g: 'musical theater', e: 'voice', era: 'musical theater', d: 8, l: 'English', src: 'Broadway canon' },
  { t: 'Seasons of Love',          c: 'Jonathan Larson',    g: 'musical theater', e: 'choir', era: 'musical theater', d: 5, l: 'English', n: 'From Rent.', src: 'Broadway canon' },
  { t: 'Light My Candle',          c: 'Jonathan Larson',    g: 'musical theater', e: 'voice', era: 'musical theater', d: 5, l: 'English', src: 'Broadway canon' },
  { t: 'When You\'re Good to Mama', c: 'John Kander',       g: 'musical theater', e: 'voice', era: 'musical theater', d: 6, l: 'English', src: 'Broadway canon' },
  { t: 'I Can Cook Too',           c: 'Leonard Bernstein',  g: 'musical theater', e: 'voice', era: 'musical theater', d: 6, l: 'English', n: 'From On the Town.', src: 'Broadway canon' },
  { t: 'Glitter and Be Gay',       c: 'Leonard Bernstein',  g: 'musical theater', e: 'voice', era: 'musical theater', d: 9, l: 'English', n: 'From Candide; coloratura.', src: 'Broadway canon' },
  { t: 'Stars',                    c: 'Claude-Michel Schönberg', g: 'musical theater', e: 'voice', era: 'musical theater', d: 7, l: 'English', n: 'From Les Misérables; baritone.', src: 'Broadway canon' },
  { t: 'No One Mourns the Wicked', c: 'Stephen Schwartz',   g: 'musical theater', e: 'choir', era: 'musical theater', d: 6, l: 'English', src: 'Broadway canon' },
];

const SACRED_CHORAL = [
  { t: 'Sicut Cervus',              c: 'Giovanni Pierluigi da Palestrina', g: 'sacred', e: 'choir', era: 'renaissance', d: 6, l: 'Latin', n: 'SATB motet.', src: 'CPDL' },
  { t: 'O Magnum Mysterium',        c: 'Tomás Luis de Victoria',          g: 'sacred', e: 'choir', era: 'renaissance', d: 7, l: 'Latin', src: 'CPDL' },
  { t: 'O Magnum Mysterium',        c: 'Morten Lauridsen',                g: 'sacred', e: 'choir', era: 'contemporary', d: 6, l: 'Latin', n: 'SATB; signature contemporary anthem.', src: 'Standard SATB' },
  { t: 'Lux Aurumque',              c: 'Eric Whitacre',                   g: 'sacred', e: 'choir', era: 'contemporary', d: 6, l: 'Latin', src: 'Standard SATB' },
  { t: 'Sleep',                     c: 'Eric Whitacre',                   g: 'choral', e: 'choir', era: 'contemporary', d: 6, l: 'English', src: 'Standard SATB' },
  { t: 'Cloudburst',                c: 'Eric Whitacre',                   g: 'choral', e: 'choir', era: 'contemporary', d: 8, l: 'Spanish', n: 'Aleatoric SATB.', src: 'Standard SATB' },
  { t: 'The Seal Lullaby',          c: 'Eric Whitacre',                   g: 'choral', e: 'choir', era: 'contemporary', d: 4, l: 'English', src: 'Standard SATB' },
  { t: 'Water Night',               c: 'Eric Whitacre',                   g: 'choral', e: 'choir', era: 'contemporary', d: 7, l: 'English', src: 'Standard SATB' },
  { t: 'Ave Maria',                 c: 'Franz Biebl',                     g: 'sacred', e: 'choir', era: 'contemporary', d: 6, l: 'Latin', n: 'Double choir TTBB or SATB.', src: 'Standard SATB' },
  { t: 'Hallelujah Chorus',         c: 'George Frideric Handel',          g: 'sacred', e: 'choir', era: 'baroque',      d: 6, l: 'English', n: 'From Messiah.', src: 'CPDL' },
  { t: 'For Unto Us a Child Is Born', c: 'George Frideric Handel',         g: 'sacred', e: 'choir', era: 'baroque',     d: 6, l: 'English', n: 'From Messiah.', src: 'CPDL' },
  { t: 'And the Glory of the Lord', c: 'George Frideric Handel',          g: 'sacred', e: 'choir', era: 'baroque',      d: 5, l: 'English', src: 'CPDL' },
  { t: 'Worthy Is the Lamb',        c: 'George Frideric Handel',          g: 'sacred', e: 'choir', era: 'baroque',      d: 7, l: 'English', src: 'CPDL' },
  { t: 'Cantique de Jean Racine',   c: 'Gabriel Fauré',                   g: 'sacred', e: 'choir', era: 'romantic',     d: 5, l: 'French', n: 'SATB with organ.', src: 'CPDL' },
  { t: 'Pie Jesu (Requiem)',        c: 'Gabriel Fauré',                   g: 'sacred', e: 'voice', era: 'romantic',     d: 5, l: 'Latin', n: 'Solo soprano.', src: 'CPDL' },
  { t: 'In Paradisum',              c: 'Gabriel Fauré',                   g: 'sacred', e: 'choir', era: 'romantic',     d: 5, l: 'Latin', src: 'CPDL' },
  { t: 'Dies Irae (Requiem)',       c: 'Giuseppe Verdi',                  g: 'sacred', e: 'choir', era: 'romantic',     d: 9, l: 'Latin', n: 'Full chorus + orchestra; advanced.', src: 'CPDL' },
  { t: 'Ubi Caritas',               c: 'Maurice Duruflé',                 g: 'sacred', e: 'choir', era: 'modern',       d: 5, l: 'Latin', src: 'Standard SATB' },
  { t: 'Lux Aeterna',               c: 'Morten Lauridsen',                g: 'sacred', e: 'choir', era: 'contemporary', d: 8, l: 'Latin', n: 'Multi-movement.', src: 'Standard SATB' },
  { t: 'Sure on This Shining Night', c: 'Morten Lauridsen',               g: 'choral', e: 'choir', era: 'contemporary', d: 6, l: 'English', src: 'Standard SATB' },
  { t: 'Sure on This Shining Night', c: 'Samuel Barber',                  g: 'choral', e: 'choir', era: 'modern',       d: 6, l: 'English', src: 'Standard SATB' },
  { t: 'Agnus Dei',                 c: 'Samuel Barber',                   g: 'sacred', e: 'choir', era: 'modern',       d: 7, l: 'Latin', n: 'SATB arrangement of Adagio for Strings.', src: 'Standard SATB' },
  { t: 'Reincarnations',            c: 'Samuel Barber',                   g: 'choral', e: 'choir', era: 'modern',       d: 8, l: 'English', src: 'Standard SATB' },
  { t: 'Five Hebrew Love Songs',    c: 'Eric Whitacre',                   g: 'choral', e: 'choir', era: 'contemporary', d: 7, l: 'Hebrew', src: 'Standard SATB' },
  { t: 'I Thank You God for Most This Amazing Day', c: 'Eric Whitacre',   g: 'choral', e: 'choir', era: 'contemporary', d: 7, l: 'English', src: 'Standard SATB' },
  { t: 'Stopping by Woods on a Snowy Evening', c: 'Randall Thompson',     g: 'choral', e: 'choir', era: 'modern',       d: 6, l: 'English', n: 'From Frostiana.', src: 'Standard SATB' },
  { t: 'Alleluia',                  c: 'Randall Thompson',                g: 'sacred', e: 'choir', era: 'modern',       d: 5, l: 'Latin', n: 'SATB a cappella; standard.', src: 'Standard SATB' },
  { t: 'The Last Words of David',   c: 'Randall Thompson',                g: 'sacred', e: 'choir', era: 'modern',       d: 6, l: 'English', src: 'Standard SATB' },
  { t: 'How Lovely Is Thy Dwelling Place', c: 'Johannes Brahms',          g: 'sacred', e: 'choir', era: 'romantic',     d: 7, l: 'German', n: 'From Ein deutsches Requiem.', src: 'CPDL' },
  { t: 'Jesu, Joy of Man\'s Desiring', c: 'Johann Sebastian Bach',         g: 'sacred', e: 'choir', era: 'baroque',     d: 5, l: 'German', src: 'CPDL' },
  { t: 'O Be Joyful in the Lord',   c: 'Benjamin Britten',                g: 'sacred', e: 'choir', era: 'modern',       d: 7, l: 'English', src: 'Standard SATB' },
  { t: 'Rejoice in the Lamb',       c: 'Benjamin Britten',                g: 'sacred', e: 'choir', era: 'modern',       d: 8, l: 'English', src: 'Standard SATB' },
  { t: 'A Hymn to the Virgin',      c: 'Benjamin Britten',                g: 'sacred', e: 'choir', era: 'modern',       d: 6, l: 'English/Latin', src: 'Standard SATB' },
  { t: 'Sing Joyfully',             c: 'William Byrd',                    g: 'sacred', e: 'choir', era: 'renaissance',  d: 6, l: 'English', src: 'CPDL' },
  { t: 'Ave Verum Corpus',          c: 'William Byrd',                    g: 'sacred', e: 'choir', era: 'renaissance',  d: 5, l: 'Latin', src: 'CPDL' },
  { t: 'Ave Verum Corpus',          c: 'Wolfgang Amadeus Mozart',         g: 'sacred', e: 'choir', era: 'classical',    d: 5, l: 'Latin', src: 'CPDL' },
  { t: 'Locus Iste',                c: 'Anton Bruckner',                  g: 'sacred', e: 'choir', era: 'romantic',     d: 6, l: 'Latin', src: 'CPDL' },
  { t: 'Os Justi',                  c: 'Anton Bruckner',                  g: 'sacred', e: 'choir', era: 'romantic',     d: 7, l: 'Latin', src: 'CPDL' },
  { t: 'Christus Factus Est',       c: 'Anton Bruckner',                  g: 'sacred', e: 'choir', era: 'romantic',     d: 7, l: 'Latin', src: 'CPDL' },
  { t: 'Total Praise',              c: 'Richard Smallwood',               g: 'gospel', e: 'choir', era: 'contemporary', d: 5, l: 'English', src: 'Gospel canon' },
  { t: 'Order My Steps',            c: 'Glenn Burleigh',                  g: 'gospel', e: 'choir', era: 'contemporary', d: 5, l: 'English', src: 'Gospel canon' },
  { t: 'I Sing Because I\'m Happy', c: 'Charles H. Gabriel', ar: 'Various', g: 'gospel', e: 'choir', era: 'contemporary', d: 5, l: 'English', src: 'Gospel canon' },
  { t: 'Goin\' Up Yonder',          c: 'Walter Hawkins',                  g: 'gospel', e: 'choir', era: 'contemporary', d: 4, l: 'English', src: 'Gospel canon' },
];

const SPIRITUALS = [
  { t: 'Deep River',               c: 'Traditional', ar: 'Harry T. Burleigh',  g: 'spiritual', e: 'voice', era: 'sacred', d: 5, l: 'English', src: 'Spiritual canon' },
  { t: 'Go Down Moses',            c: 'Traditional', ar: 'Various',            g: 'spiritual', e: 'voice', era: 'sacred', d: 4, l: 'English', src: 'Spiritual canon' },
  { t: 'Swing Low, Sweet Chariot', c: 'Traditional', ar: 'Various',            g: 'spiritual', e: 'voice', era: 'sacred', d: 3, l: 'English', src: 'Spiritual canon' },
  { t: 'Steal Away',               c: 'Traditional', ar: 'Various',            g: 'spiritual', e: 'choir', era: 'sacred', d: 4, l: 'English', src: 'Spiritual canon' },
  { t: 'Wade in the Water',        c: 'Traditional', ar: 'Moses Hogan',        g: 'spiritual', e: 'choir', era: 'sacred', d: 6, l: 'English', src: 'Spiritual canon' },
  { t: 'Ride on, King Jesus',      c: 'Traditional', ar: 'Hall Johnson',       g: 'spiritual', e: 'voice', era: 'sacred', d: 7, l: 'English', src: 'Spiritual canon' },
  { t: 'My Lord, What a Mornin\'', c: 'Traditional', ar: 'Harry T. Burleigh',  g: 'spiritual', e: 'voice', era: 'sacred', d: 4, l: 'English', src: 'Spiritual canon' },
  { t: 'Witness',                  c: 'Traditional', ar: 'Jack Halloran',      g: 'spiritual', e: 'choir', era: 'sacred', d: 6, l: 'English', src: 'Spiritual canon' },
  { t: 'Elijah Rock',              c: 'Traditional', ar: 'Jester Hairston',    g: 'spiritual', e: 'choir', era: 'sacred', d: 6, l: 'English', src: 'Spiritual canon' },
  { t: 'Ain\'t-A That Good News',  c: 'Traditional', ar: 'William L. Dawson',  g: 'spiritual', e: 'choir', era: 'sacred', d: 6, l: 'English', src: 'Spiritual canon' },
  { t: 'Soon Ah Will Be Done',     c: 'Traditional', ar: 'William L. Dawson',  g: 'spiritual', e: 'choir', era: 'sacred', d: 7, l: 'English', src: 'Spiritual canon' },
  { t: 'Were You There',           c: 'Traditional', ar: 'Various',            g: 'spiritual', e: 'choir', era: 'sacred', d: 4, l: 'English', src: 'Spiritual canon' },
  { t: 'I Want Jesus to Walk with Me', c: 'Traditional', ar: 'Various',         g: 'spiritual', e: 'voice', era: 'sacred', d: 4, l: 'English', src: 'Spiritual canon' },
  { t: 'There Is a Balm in Gilead', c: 'Traditional', ar: 'William L. Dawson',  g: 'spiritual', e: 'choir', era: 'sacred', d: 5, l: 'English', src: 'Spiritual canon' },
  { t: 'Hold On!',                 c: 'Traditional', ar: 'Jester Hairston',    g: 'spiritual', e: 'choir', era: 'sacred', d: 6, l: 'English', src: 'Spiritual canon' },
];

const WIND_BAND = [
  { t: 'Lincolnshire Posy',           c: 'Percy Aldridge Grainger',  g: 'wind ensemble', e: 'band', era: 'modern',       d: 9, src: 'Standard wind ensemble' },
  { t: 'Irish Tune from County Derry', c: 'Percy Aldridge Grainger', g: 'wind ensemble', e: 'band', era: 'modern',       d: 5, src: 'Standard wind ensemble' },
  { t: 'Shepherd\'s Hey',             c: 'Percy Aldridge Grainger',  g: 'wind ensemble', e: 'band', era: 'modern',       d: 6, src: 'Standard wind ensemble' },
  { t: 'Children\'s March',           c: 'Percy Aldridge Grainger',  g: 'wind ensemble', e: 'band', era: 'modern',       d: 7, src: 'Standard wind ensemble' },
  { t: 'First Suite in E-flat for Military Band', c: 'Gustav Holst', g: 'wind ensemble', e: 'band', era: 'modern',       d: 7, src: 'Standard wind ensemble' },
  { t: 'Second Suite in F for Military Band', c: 'Gustav Holst',     g: 'wind ensemble', e: 'band', era: 'modern',       d: 7, src: 'Standard wind ensemble' },
  { t: 'Hammersmith',                 c: 'Gustav Holst',             g: 'wind ensemble', e: 'band', era: 'modern',       d: 9, src: 'Standard wind ensemble' },
  { t: 'English Folk Song Suite',     c: 'Ralph Vaughan Williams',   g: 'wind ensemble', e: 'band', era: 'modern',       d: 6, src: 'Standard wind ensemble' },
  { t: 'Toccata Marziale',            c: 'Ralph Vaughan Williams',   g: 'wind ensemble', e: 'band', era: 'modern',       d: 8, src: 'Standard wind ensemble' },
  { t: 'Symphony No. 6',              c: 'Vincent Persichetti',      g: 'wind ensemble', e: 'band', era: 'modern',       d: 9, src: 'Standard wind ensemble' },
  { t: 'Divertimento for Band',       c: 'Vincent Persichetti',      g: 'wind ensemble', e: 'band', era: 'modern',       d: 7, src: 'Standard wind ensemble' },
  { t: 'Pageant',                     c: 'Vincent Persichetti',      g: 'wind ensemble', e: 'band', era: 'modern',       d: 6, src: 'Standard wind ensemble' },
  { t: 'Suite Française',             c: 'Darius Milhaud',           g: 'wind ensemble', e: 'band', era: 'modern',       d: 7, src: 'Standard wind ensemble' },
  { t: 'La Fiesta Mexicana',          c: 'H. Owen Reed',             g: 'wind ensemble', e: 'band', era: 'modern',       d: 8, src: 'Standard wind ensemble' },
  { t: 'Armenian Dances Part 1',      c: 'Alfred Reed',              g: 'wind ensemble', e: 'band', era: 'modern',       d: 7, src: 'Standard wind ensemble' },
  { t: 'El Camino Real',              c: 'Alfred Reed',              g: 'wind ensemble', e: 'band', era: 'modern',       d: 7, src: 'Standard wind ensemble' },
  { t: 'A Festival Prelude',          c: 'Alfred Reed',              g: 'wind ensemble', e: 'band', era: 'modern',       d: 5, src: 'Standard wind ensemble' },
  { t: 'Russian Christmas Music',     c: 'Alfred Reed',              g: 'wind ensemble', e: 'band', era: 'modern',       d: 6, src: 'Standard wind ensemble' },
  { t: 'October',                     c: 'Eric Whitacre',            g: 'wind ensemble', e: 'band', era: 'contemporary', d: 6, src: 'Standard wind ensemble' },
  { t: 'Equus',                       c: 'Eric Whitacre',            g: 'wind ensemble', e: 'band', era: 'contemporary', d: 7, src: 'Standard wind ensemble' },
  { t: 'Ghost Train Triptych',        c: 'Eric Whitacre',            g: 'wind ensemble', e: 'band', era: 'contemporary', d: 8, src: 'Standard wind ensemble' },
  { t: 'Godzilla Eats Las Vegas!',    c: 'Eric Whitacre',            g: 'wind ensemble', e: 'band', era: 'contemporary', d: 7, src: 'Standard wind ensemble' },
  { t: 'Variations on a Korean Folk Song', c: 'John Barnes Chance',  g: 'wind ensemble', e: 'band', era: 'modern',       d: 6, src: 'Standard wind ensemble' },
  { t: 'Incantation and Dance',       c: 'John Barnes Chance',       g: 'wind ensemble', e: 'band', era: 'modern',       d: 8, src: 'Standard wind ensemble' },
  { t: 'Blue Shades',                 c: 'Frank Ticheli',            g: 'wind ensemble', e: 'band', era: 'contemporary', d: 7, src: 'Standard wind ensemble' },
  { t: 'Vesuvius',                    c: 'Frank Ticheli',            g: 'wind ensemble', e: 'band', era: 'contemporary', d: 6, src: 'Standard wind ensemble' },
  { t: 'Shenandoah',                  c: 'Traditional', ar: 'Frank Ticheli', g: 'wind ensemble', e: 'band', era: 'contemporary', d: 5, src: 'Standard wind ensemble' },
  { t: 'An American Elegy',           c: 'Frank Ticheli',            g: 'wind ensemble', e: 'band', era: 'contemporary', d: 6, src: 'Standard wind ensemble' },
  { t: 'Cajun Folk Songs',            c: 'Frank Ticheli',            g: 'wind ensemble', e: 'band', era: 'contemporary', d: 5, src: 'Standard wind ensemble' },
  { t: 'Postcard',                    c: 'Frank Ticheli',            g: 'wind ensemble', e: 'band', era: 'contemporary', d: 7, src: 'Standard wind ensemble' },
  { t: 'Of Sailors and Whales',       c: 'W. Francis McBeth',        g: 'wind ensemble', e: 'band', era: 'modern',       d: 7, src: 'Standard wind ensemble' },
  { t: 'Masque',                      c: 'W. Francis McBeth',        g: 'wind ensemble', e: 'band', era: 'modern',       d: 4, src: 'Standard wind ensemble' },
  { t: 'Chant and Jubilo',            c: 'W. Francis McBeth',        g: 'wind ensemble', e: 'band', era: 'modern',       d: 4, src: 'Standard wind ensemble' },
  { t: 'Resting in the Peace of His Hands', c: 'John Gibson',        g: 'wind ensemble', e: 'band', era: 'contemporary', d: 3, src: 'Standard wind ensemble' },
  { t: 'Salvation Is Created',        c: 'Pavel Chesnokov', ar: 'Bruce Houseknecht', g: 'wind ensemble', e: 'band', era: 'modern', d: 4, src: 'Standard wind ensemble' },
  { t: 'Sketches on a Tudor Psalm',   c: 'Fisher Tull',              g: 'wind ensemble', e: 'band', era: 'modern',       d: 7, src: 'Standard wind ensemble' },
  { t: 'Old Home Days',               c: 'Charles Ives', ar: 'Jonathan Elkus', g: 'wind ensemble', e: 'band', era: 'modern', d: 6, src: 'Standard wind ensemble' },
  { t: 'Symphonic Songs for Band',    c: 'Robert Russell Bennett',   g: 'wind ensemble', e: 'band', era: 'modern',       d: 7, src: 'Standard wind ensemble' },
  { t: 'And Can It Be?',              c: 'Dan Forrest',              g: 'wind ensemble', e: 'band', era: 'contemporary', d: 5, src: 'Standard wind ensemble' },
  { t: 'Of Our New Day Begun',        c: 'Omar Thomas',              g: 'wind ensemble', e: 'band', era: 'contemporary', d: 8, src: 'Standard wind ensemble' },
  { t: 'Come Sunday',                 c: 'Omar Thomas',              g: 'wind ensemble', e: 'band', era: 'contemporary', d: 7, src: 'Standard wind ensemble' },
  { t: 'Mothership',                  c: 'Mason Bates',              g: 'wind ensemble', e: 'band', era: 'contemporary', d: 8, src: 'Standard wind ensemble' },
];

const MARCHES = [
  { t: 'The Stars and Stripes Forever', c: 'John Philip Sousa',     g: 'march', e: 'band', era: 'romantic', d: 5, src: 'Standard march' },
  { t: 'Semper Fidelis',              c: 'John Philip Sousa',       g: 'march', e: 'band', era: 'romantic', d: 5, src: 'Standard march' },
  { t: 'The Washington Post',         c: 'John Philip Sousa',       g: 'march', e: 'band', era: 'romantic', d: 4, src: 'Standard march' },
  { t: 'The Liberty Bell',            c: 'John Philip Sousa',       g: 'march', e: 'band', era: 'romantic', d: 5, src: 'Standard march' },
  { t: 'El Capitán',                  c: 'John Philip Sousa',       g: 'march', e: 'band', era: 'romantic', d: 4, src: 'Standard march' },
  { t: 'The Thunderer',               c: 'John Philip Sousa',       g: 'march', e: 'band', era: 'romantic', d: 5, src: 'Standard march' },
  { t: 'Hands Across the Sea',        c: 'John Philip Sousa',       g: 'march', e: 'band', era: 'romantic', d: 5, src: 'Standard march' },
  { t: 'King Cotton',                 c: 'John Philip Sousa',       g: 'march', e: 'band', era: 'romantic', d: 4, src: 'Standard march' },
  { t: 'Colonel Bogey March',         c: 'Kenneth J. Alford',       g: 'march', e: 'band', era: 'modern',   d: 4, src: 'Standard march' },
  { t: 'Army of the Nile',            c: 'Kenneth J. Alford',       g: 'march', e: 'band', era: 'modern',   d: 5, src: 'Standard march' },
  { t: 'On the Mall',                 c: 'Edwin Franko Goldman',    g: 'march', e: 'band', era: 'modern',   d: 4, src: 'Standard march' },
  { t: 'Americans We',                c: 'Henry Fillmore',          g: 'march', e: 'band', era: 'modern',   d: 4, src: 'Standard march' },
  { t: 'His Honor',                   c: 'Henry Fillmore',          g: 'march', e: 'band', era: 'modern',   d: 4, src: 'Standard march' },
];

const BRASS_CHAMBER = [
  { t: 'Quintet No. 1',                 c: 'Victor Ewald',             g: 'chamber', e: 'chamber', era: 'romantic', d: 7, ins: 'Brass quintet', src: 'Standard brass quintet' },
  { t: 'Quintet No. 3',                 c: 'Victor Ewald',             g: 'chamber', e: 'chamber', era: 'romantic', d: 7, ins: 'Brass quintet', src: 'Standard brass quintet' },
  { t: 'Quintet for Brass',             c: 'Malcolm Arnold',           g: 'chamber', e: 'chamber', era: 'modern',   d: 7, ins: 'Brass quintet', src: 'Standard brass quintet' },
  { t: 'Music for Brass Instruments',   c: 'Ingolf Dahl',              g: 'chamber', e: 'chamber', era: 'modern',   d: 8, ins: 'Brass quintet', src: 'Standard brass quintet' },
  { t: 'Three Equali',                  c: 'Ludwig van Beethoven',     g: 'chamber', e: 'chamber', era: 'classical', d: 5, ins: 'Trombone quartet', src: 'Standard trombone literature' },
  { t: 'Bydlo (from Pictures at an Exhibition)', c: 'Modest Mussorgsky', ar: 'Various', g: 'chamber', e: 'chamber', era: 'romantic', d: 6, ins: 'Brass ensemble', src: 'Standard brass arrangement' },
  { t: 'Canzon Septimi Toni No. 2',     c: 'Giovanni Gabrieli',         g: 'chamber', e: 'chamber', era: 'renaissance', d: 6, ins: 'Brass choir', src: 'Standard brass literature' },
  { t: 'Canzona per Sonare No. 2',      c: 'Giovanni Gabrieli',         g: 'chamber', e: 'chamber', era: 'renaissance', d: 6, ins: 'Brass choir', src: 'Standard brass literature' },
  { t: 'Sonata pian e forte',           c: 'Giovanni Gabrieli',         g: 'chamber', e: 'chamber', era: 'renaissance', d: 7, ins: 'Brass choir', src: 'Standard brass literature' },
  { t: 'Fanfare for the Common Man',    c: 'Aaron Copland',             g: 'fanfare', e: 'chamber', era: 'modern',     d: 6, ins: 'Brass and percussion', src: 'Standard brass literature' },
  { t: 'Music for the Royal Fireworks (Brass arr.)', c: 'George Frideric Handel', ar: 'Various', g: 'chamber', e: 'chamber', era: 'baroque', d: 7, ins: 'Brass ensemble', src: 'Standard brass arrangement' },
];

const WOODWIND_CHAMBER = [
  { t: 'Quintet for Winds No. 1',     c: 'Anton Reicha',             g: 'chamber', e: 'chamber', era: 'classical', d: 7, ins: 'Woodwind quintet', src: 'Standard ww quintet' },
  { t: 'Three Shanties',              c: 'Malcolm Arnold',           g: 'chamber', e: 'chamber', era: 'modern',    d: 6, ins: 'Woodwind quintet', src: 'Standard ww quintet' },
  { t: 'Summer Music',                c: 'Samuel Barber',            g: 'chamber', e: 'chamber', era: 'modern',    d: 8, ins: 'Woodwind quintet', src: 'Standard ww quintet' },
  { t: 'Six Bagatelles',              c: 'György Ligeti',            g: 'chamber', e: 'chamber', era: 'modern',    d: 8, ins: 'Woodwind quintet', src: 'Standard ww quintet' },
  { t: 'Trois Pièces Brèves',         c: 'Jacques Ibert',            g: 'chamber', e: 'chamber', era: 'modern',    d: 7, ins: 'Woodwind quintet', src: 'Standard ww quintet' },
  { t: 'Kleine Kammermusik',          c: 'Paul Hindemith',           g: 'chamber', e: 'chamber', era: 'modern',    d: 7, ins: 'Woodwind quintet', src: 'Standard ww quintet' },
  { t: 'Quintet in E-flat major',     c: 'Franz Danzi',              g: 'chamber', e: 'chamber', era: 'classical', d: 6, ins: 'Woodwind quintet', src: 'Standard ww quintet' },
];

const TRUMPET = [
  { t: 'Concerto in E-flat',           c: 'Johann Nepomuk Hummel',    g: 'concerto', e: 'solo', era: 'classical', d: 8, ins: 'Trumpet & piano/orchestra', src: 'Standard trumpet literature' },
  { t: 'Concerto in E-flat',           c: 'Franz Joseph Haydn',       g: 'concerto', e: 'solo', era: 'classical', d: 8, ins: 'Trumpet & orchestra', src: 'Standard trumpet literature' },
  { t: 'Sonata for Trumpet and Piano', c: 'Paul Hindemith',           g: 'sonata',   e: 'solo', era: 'modern',    d: 8, ins: 'Trumpet & piano', src: 'Standard trumpet literature' },
  { t: 'Sonata for Trumpet and Piano', c: 'Kent Kennan',              g: 'sonata',   e: 'solo', era: 'modern',    d: 7, ins: 'Trumpet & piano', src: 'Standard trumpet literature' },
  { t: 'Sonata for Trumpet and Piano', c: 'Halsey Stevens',           g: 'sonata',   e: 'solo', era: 'modern',    d: 7, ins: 'Trumpet & piano', src: 'Standard trumpet literature' },
  { t: 'Légende',                      c: 'Georges Enesco',           g: 'solo',     e: 'solo', era: 'modern',    d: 7, ins: 'Trumpet & piano', src: 'Standard trumpet literature' },
  { t: 'Andante et Allegretto',        c: 'Guillaume Balay',          g: 'solo',     e: 'solo', era: 'romantic',  d: 5, ins: 'Trumpet & piano', src: 'Standard trumpet literature' },
  { t: 'Charlier 36 Études',           c: 'Théo Charlier',            g: 'étude',    e: 'solo', era: 'romantic',  d: 9, ins: 'Trumpet', p: 'method book', src: 'Standard trumpet literature' },
  { t: 'Arban Complete Method',        c: 'Jean-Baptiste Arban',      g: 'method',   e: 'solo', era: 'romantic',  d: 5, ins: 'Trumpet', p: 'method book', src: 'Standard trumpet literature' },
  { t: 'Carnival of Venice',           c: 'Jean-Baptiste Arban',      g: 'variation', e: 'solo', era: 'romantic', d: 9, ins: 'Trumpet & piano', src: 'Standard trumpet literature' },
  { t: 'Concerto for Trumpet',         c: 'Alexander Arutiunian',     g: 'concerto', e: 'solo', era: 'modern',    d: 9, ins: 'Trumpet & orchestra', src: 'Standard trumpet literature' },
  { t: 'Rustiques',                    c: 'Eugène Bozza',             g: 'solo',     e: 'solo', era: 'modern',    d: 8, ins: 'Trumpet & piano', src: 'Standard trumpet literature' },
];

const TROMBONE = [
  { t: 'Concertino in E-flat',         c: 'Ferdinand David',          g: 'concerto', e: 'solo', era: 'romantic',  d: 8, ins: 'Trombone & piano/orch', src: 'Standard trombone literature' },
  { t: 'Sonata in F minor',            c: 'Benedetto Marcello', ar: 'Various', g: 'sonata', e: 'solo', era: 'baroque', d: 5, ins: 'Trombone & piano', src: 'Standard trombone literature' },
  { t: 'Cavatine, Op. 144',            c: 'Camille Saint-Saëns',      g: 'solo',     e: 'solo', era: 'romantic',  d: 6, ins: 'Trombone & piano', src: 'Standard trombone literature' },
  { t: 'Concerto for Trombone',        c: 'Launy Grøndahl',           g: 'concerto', e: 'solo', era: 'modern',    d: 8, ins: 'Trombone & orchestra', src: 'Standard trombone literature' },
  { t: 'Morceau Symphonique',          c: 'Alexandre Guilmant',       g: 'solo',     e: 'solo', era: 'romantic',  d: 6, ins: 'Trombone & piano', src: 'Standard trombone literature' },
  { t: 'Sonata for Trombone',          c: 'Paul Hindemith',           g: 'sonata',   e: 'solo', era: 'modern',    d: 8, ins: 'Trombone & piano', src: 'Standard trombone literature' },
  { t: 'Blue Bells of Scotland',       c: 'Arthur Pryor',             g: 'variation', e: 'solo', era: 'romantic', d: 7, ins: 'Trombone & piano', src: 'Standard trombone literature' },
  { t: 'Andante et Allegro',           c: 'Joseph Guy Ropartz',        g: 'solo',     e: 'solo', era: 'romantic',  d: 5, ins: 'Trombone & piano', src: 'Standard trombone literature' },
  { t: 'Rochut Melodious Etudes',      c: 'Joannes Rochut',           g: 'étude',    e: 'solo', era: 'romantic',  d: 6, ins: 'Trombone', p: 'method book', src: 'Standard trombone literature' },
];

const HORN = [
  { t: 'Concerto No. 1 in D, K. 412',   c: 'Wolfgang Amadeus Mozart', g: 'concerto', e: 'solo', era: 'classical', d: 7, ins: 'Horn & orchestra', src: 'Standard horn literature' },
  { t: 'Concerto No. 3 in E-flat, K. 447', c: 'Wolfgang Amadeus Mozart', g: 'concerto', e: 'solo', era: 'classical', d: 8, ins: 'Horn & orchestra', src: 'Standard horn literature' },
  { t: 'Concerto No. 4 in E-flat, K. 495', c: 'Wolfgang Amadeus Mozart', g: 'concerto', e: 'solo', era: 'classical', d: 8, ins: 'Horn & orchestra', src: 'Standard horn literature' },
  { t: 'Sonata for Horn and Piano',     c: 'Paul Hindemith',          g: 'sonata',   e: 'solo', era: 'modern',    d: 8, ins: 'Horn & piano', src: 'Standard horn literature' },
  { t: 'Villanelle',                    c: 'Paul Dukas',              g: 'solo',     e: 'solo', era: 'romantic',  d: 8, ins: 'Horn & piano', src: 'Standard horn literature' },
  { t: 'Nocturno, Op. 7',               c: 'Franz Strauss',           g: 'solo',     e: 'solo', era: 'romantic',  d: 7, ins: 'Horn & piano', src: 'Standard horn literature' },
  { t: 'Adagio and Allegro',            c: 'Robert Schumann',         g: 'solo',     e: 'solo', era: 'romantic',  d: 8, ins: 'Horn & piano', src: 'Standard horn literature' },
  { t: 'En Forêt, Op. 40',              c: 'Eugène Bozza',            g: 'solo',     e: 'solo', era: 'modern',    d: 9, ins: 'Horn & piano', src: 'Standard horn literature' },
  { t: 'Kopprasch 60 Etudes',           c: 'Georg Kopprasch',          g: 'étude',    e: 'solo', era: 'romantic',  d: 6, ins: 'Horn', p: 'method book', src: 'Standard horn literature' },
];

const FLUTE = [
  { t: 'Concerto in D Major, K. 314',  c: 'Wolfgang Amadeus Mozart', g: 'concerto', e: 'solo', era: 'classical', d: 8, ins: 'Flute & orchestra', src: 'Standard flute literature' },
  { t: 'Sonata in E-flat, BWV 1031',   c: 'Johann Sebastian Bach',   g: 'sonata',   e: 'solo', era: 'baroque',   d: 7, ins: 'Flute & continuo', src: 'Standard flute literature' },
  { t: 'Partita in A minor, BWV 1013', c: 'Johann Sebastian Bach',   g: 'partita',  e: 'solo', era: 'baroque',   d: 8, ins: 'Solo flute', src: 'Standard flute literature' },
  { t: 'Sonata in F major, Op. 1 No. 11', c: 'George Frideric Handel', g: 'sonata',  e: 'solo', era: 'baroque', d: 5, ins: 'Flute & continuo', src: 'Standard flute literature' },
  { t: 'Syrinx',                       c: 'Claude Debussy',           g: 'solo',     e: 'solo', era: 'modern',    d: 7, ins: 'Solo flute', src: 'Standard flute literature' },
  { t: 'Sonata for Flute and Piano',   c: 'Francis Poulenc',          g: 'sonata',   e: 'solo', era: 'modern',    d: 8, ins: 'Flute & piano', src: 'Standard flute literature' },
  { t: 'Sonatine',                     c: 'Henri Dutilleux',          g: 'sonatine', e: 'solo', era: 'modern',    d: 8, ins: 'Flute & piano', src: 'Standard flute literature' },
  { t: 'Carmen Fantasy',               c: 'François Borne',           g: 'fantasy',  e: 'solo', era: 'romantic',  d: 9, ins: 'Flute & piano', src: 'Standard flute literature' },
  { t: 'Density 21.5',                 c: 'Edgard Varèse',            g: 'solo',     e: 'solo', era: 'modern',    d: 8, ins: 'Solo flute', src: 'Standard flute literature' },
  { t: 'Concertino, Op. 107',          c: 'Cécile Chaminade',         g: 'concertino', e: 'solo', era: 'romantic', d: 7, ins: 'Flute & piano/orch', src: 'Standard flute literature' },
  { t: 'Image, Op. 38',                c: 'Eugène Bozza',             g: 'solo',     e: 'solo', era: 'modern',    d: 7, ins: 'Solo flute', src: 'Standard flute literature' },
  { t: 'Andersen 24 Etudes, Op. 15',   c: 'Joachim Andersen',         g: 'étude',    e: 'solo', era: 'romantic',  d: 7, ins: 'Flute', p: 'method book', src: 'Standard flute literature' },
];

const CLARINET = [
  { t: 'Concerto in A major, K. 622',  c: 'Wolfgang Amadeus Mozart', g: 'concerto', e: 'solo', era: 'classical', d: 9, ins: 'Clarinet & orchestra', src: 'Standard clarinet literature' },
  { t: 'Quintet for Clarinet and Strings, K. 581', c: 'Wolfgang Amadeus Mozart', g: 'chamber', e: 'chamber', era: 'classical', d: 8, ins: 'Clarinet & string quartet', src: 'Standard clarinet literature' },
  { t: 'Quintet for Clarinet and Strings, Op. 115', c: 'Johannes Brahms', g: 'chamber', e: 'chamber', era: 'romantic', d: 8, ins: 'Clarinet & string quartet', src: 'Standard clarinet literature' },
  { t: 'Sonata in F minor, Op. 120 No. 1', c: 'Johannes Brahms',     g: 'sonata',   e: 'solo', era: 'romantic',  d: 8, ins: 'Clarinet & piano', src: 'Standard clarinet literature' },
  { t: 'Sonata in E-flat, Op. 120 No. 2',  c: 'Johannes Brahms',     g: 'sonata',   e: 'solo', era: 'romantic',  d: 8, ins: 'Clarinet & piano', src: 'Standard clarinet literature' },
  { t: 'Première Rhapsodie',           c: 'Claude Debussy',           g: 'solo',     e: 'solo', era: 'modern',    d: 8, ins: 'Clarinet & piano', src: 'Standard clarinet literature' },
  { t: 'Solo de Concours',             c: 'André Messager',           g: 'solo',     e: 'solo', era: 'romantic',  d: 7, ins: 'Clarinet & piano', src: 'Standard clarinet literature' },
  { t: 'Sonata for Clarinet and Piano', c: 'Francis Poulenc',         g: 'sonata',   e: 'solo', era: 'modern',    d: 8, ins: 'Clarinet & piano', src: 'Standard clarinet literature' },
  { t: 'Three Pieces for Clarinet Solo', c: 'Igor Stravinsky',        g: 'solo',     e: 'solo', era: 'modern',    d: 7, ins: 'Solo clarinet', src: 'Standard clarinet literature' },
  { t: 'Concertino, Op. 26',           c: 'Carl Maria von Weber',     g: 'concertino', e: 'solo', era: 'romantic', d: 7, ins: 'Clarinet & piano/orch', src: 'Standard clarinet literature' },
  { t: 'Concerto No. 1 in F minor, Op. 73', c: 'Carl Maria von Weber', g: 'concerto', e: 'solo', era: 'romantic', d: 8, ins: 'Clarinet & orchestra', src: 'Standard clarinet literature' },
  { t: 'Concerto No. 2 in E-flat, Op. 74', c: 'Carl Maria von Weber', g: 'concerto', e: 'solo', era: 'romantic', d: 9, ins: 'Clarinet & orchestra', src: 'Standard clarinet literature' },
];

const OBOE_BASSOON = [
  { t: 'Concerto in C major, K. 314',  c: 'Wolfgang Amadeus Mozart', g: 'concerto', e: 'solo', era: 'classical', d: 8, ins: 'Oboe & orchestra', src: 'Standard oboe literature' },
  { t: 'Sonata for Oboe and Piano',    c: 'Camille Saint-Saëns',     g: 'sonata',   e: 'solo', era: 'romantic',  d: 7, ins: 'Oboe & piano', src: 'Standard oboe literature' },
  { t: 'Sonata for Oboe and Piano',    c: 'Francis Poulenc',         g: 'sonata',   e: 'solo', era: 'modern',    d: 8, ins: 'Oboe & piano', src: 'Standard oboe literature' },
  { t: 'Six Metamorphoses after Ovid', c: 'Benjamin Britten',         g: 'solo',     e: 'solo', era: 'modern',    d: 8, ins: 'Solo oboe', src: 'Standard oboe literature' },
  { t: 'Concerto in D minor',          c: 'Alessandro Marcello',      g: 'concerto', e: 'solo', era: 'baroque',   d: 6, ins: 'Oboe & continuo', src: 'Standard oboe literature' },
  { t: 'Concerto in B-flat, K. 191',   c: 'Wolfgang Amadeus Mozart', g: 'concerto', e: 'solo', era: 'classical', d: 8, ins: 'Bassoon & orchestra', src: 'Standard bassoon literature' },
  { t: 'Sonata in B-flat, BWV 1030',   c: 'Johann Sebastian Bach',    g: 'sonata',   e: 'solo', era: 'baroque',   d: 7, ins: 'Bassoon & continuo', src: 'Standard bassoon literature' },
  { t: 'Concerto for Bassoon',         c: 'Carl Maria von Weber',     g: 'concerto', e: 'solo', era: 'romantic',  d: 8, ins: 'Bassoon & orchestra', src: 'Standard bassoon literature' },
  { t: 'Five Bagatelles',              c: 'Gerald Finzi',             g: 'solo',     e: 'solo', era: 'modern',    d: 7, ins: 'Clarinet & piano', src: 'Standard clarinet literature' },
];

const SAXOPHONE = [
  { t: 'Concerto in E-flat',           c: 'Alexander Glazunov',        g: 'concerto', e: 'solo', era: 'romantic',  d: 9, ins: 'Alto saxophone & orch', src: 'Standard saxophone literature' },
  { t: 'Scaramouche',                  c: 'Darius Milhaud',            g: 'solo',     e: 'solo', era: 'modern',    d: 8, ins: 'Alto sax & piano', src: 'Standard saxophone literature' },
  { t: 'Tableaux de Provence',         c: 'Paule Maurice',             g: 'solo',     e: 'solo', era: 'modern',    d: 8, ins: 'Alto sax & piano', src: 'Standard saxophone literature' },
  { t: 'Prelude, Cadence et Finale',   c: 'Alfred Desenclos',          g: 'solo',     e: 'solo', era: 'modern',    d: 9, ins: 'Alto sax & piano', src: 'Standard saxophone literature' },
  { t: 'Sonata for Alto Saxophone',    c: 'Paul Creston',              g: 'sonata',   e: 'solo', era: 'modern',    d: 8, ins: 'Alto sax & piano', src: 'Standard saxophone literature' },
  { t: 'Concertino da Camera',         c: 'Jacques Ibert',             g: 'concertino', e: 'solo', era: 'modern',  d: 9, ins: 'Alto sax & chamber orch', src: 'Standard saxophone literature' },
  { t: 'Sequenza VIIb',                c: 'Luciano Berio',             g: 'solo',     e: 'solo', era: 'contemporary', d: 10, ins: 'Solo soprano sax', src: 'Standard saxophone literature' },
  { t: 'Fantasy, Op. 75',              c: 'Heitor Villa-Lobos',         g: 'solo',     e: 'solo', era: 'modern',    d: 7, ins: 'Alto sax & piano', src: 'Standard saxophone literature' },
  { t: 'Improvisation et Caprice',     c: 'Eugène Bozza',              g: 'solo',     e: 'solo', era: 'modern',    d: 6, ins: 'Solo alto sax', src: 'Standard saxophone literature' },
];

const VIOLIN_VIOLA_CELLO = [
  { t: 'Praeludium and Allegro',      c: 'Fritz Kreisler', ar: 'in the style of Pugnani', g: 'solo', e: 'solo', era: 'romantic', d: 7, ins: 'Violin & piano', src: 'Standard violin literature' },
  { t: 'Liebesleid',                  c: 'Fritz Kreisler',           g: 'solo',     e: 'solo', era: 'romantic',  d: 6, ins: 'Violin & piano', src: 'Standard violin literature' },
  { t: 'Liebesfreud',                 c: 'Fritz Kreisler',           g: 'solo',     e: 'solo', era: 'romantic',  d: 6, ins: 'Violin & piano', src: 'Standard violin literature' },
  { t: 'Schön Rosmarin',              c: 'Fritz Kreisler',           g: 'solo',     e: 'solo', era: 'romantic',  d: 6, ins: 'Violin & piano', src: 'Standard violin literature' },
  { t: 'Meditation from Thaïs',       c: 'Jules Massenet',           g: 'solo',     e: 'solo', era: 'romantic',  d: 6, ins: 'Violin & piano', src: 'Standard violin literature' },
  { t: 'Romance in F major, Op. 50',  c: 'Ludwig van Beethoven',     g: 'solo',     e: 'solo', era: 'classical', d: 7, ins: 'Violin & orchestra', src: 'Standard violin literature' },
  { t: 'Romance in G major, Op. 40',  c: 'Ludwig van Beethoven',     g: 'solo',     e: 'solo', era: 'classical', d: 6, ins: 'Violin & orchestra', src: 'Standard violin literature' },
  { t: 'Csárdás',                     c: 'Vittorio Monti',           g: 'solo',     e: 'solo', era: 'romantic',  d: 6, ins: 'Violin & piano', src: 'Standard violin literature' },
  { t: 'Banjo and Fiddle',            c: 'William Kroll',            g: 'solo',     e: 'solo', era: 'modern',    d: 6, ins: 'Violin & piano', src: 'Standard violin literature' },
  { t: 'Suzuki Violin School Vol. 1', c: 'Shinichi Suzuki',          g: 'method',   e: 'solo', era: 'modern',    d: 1, ins: 'Solo violin', p: 'method book', src: 'Suzuki method' },
  { t: 'Suzuki Violin School Vol. 4', c: 'Shinichi Suzuki',          g: 'method',   e: 'solo', era: 'modern',    d: 4, ins: 'Solo violin', p: 'method book', src: 'Suzuki method' },
  { t: 'Kreutzer 42 Études',          c: 'Rodolphe Kreutzer',         g: 'étude',    e: 'solo', era: 'classical', d: 8, ins: 'Solo violin', p: 'method book', src: 'Standard violin literature' },
  { t: 'Wieniawski 8 Études-Caprices, Op. 18', c: 'Henryk Wieniawski', g: 'étude', e: 'solo', era: 'romantic',  d: 9, ins: 'Solo violin', src: 'Standard violin literature' },
  { t: 'Concerto in A minor, BWV 1041', c: 'Johann Sebastian Bach', g: 'concerto', e: 'solo', era: 'baroque',   d: 7, ins: 'Violin & orchestra', src: 'Standard violin literature' },
  { t: 'Suite for Solo Cello No. 1, BWV 1007', c: 'Johann Sebastian Bach', g: 'suite', e: 'solo', era: 'baroque', d: 7, ins: 'Solo cello', src: 'Standard cello literature' },
  { t: 'Élégie, Op. 24',              c: 'Gabriel Fauré',            g: 'solo',     e: 'solo', era: 'romantic',  d: 7, ins: 'Cello & piano', src: 'Standard cello literature' },
  { t: 'The Swan',                    c: 'Camille Saint-Saëns',      g: 'solo',     e: 'solo', era: 'romantic',  d: 5, ins: 'Cello & piano', src: 'Standard cello literature' },
  { t: 'Kol Nidrei, Op. 47',          c: 'Max Bruch',                g: 'solo',     e: 'solo', era: 'romantic',  d: 8, ins: 'Cello & orchestra', src: 'Standard cello literature' },
  { t: 'Variations on a Rococo Theme', c: 'Pyotr Ilyich Tchaikovsky', g: 'solo',    e: 'solo', era: 'romantic',  d: 9, ins: 'Cello & orchestra', src: 'Standard cello literature' },
  { t: 'Sonata for Solo Viola, Op. 25 No. 1', c: 'Paul Hindemith',    g: 'sonata',  e: 'solo', era: 'modern',    d: 9, ins: 'Solo viola', src: 'Standard viola literature' },
  { t: 'Suite for Viola',             c: 'Ernest Bloch',             g: 'suite',    e: 'solo', era: 'modern',    d: 9, ins: 'Solo viola', src: 'Standard viola literature' },
  { t: 'Élégie for Viola',            c: 'Henri Vieuxtemps',         g: 'solo',     e: 'solo', era: 'romantic',  d: 7, ins: 'Viola & piano', src: 'Standard viola literature' },
  { t: 'Konzertstück für Viola',      c: 'George Enescu',            g: 'solo',     e: 'solo', era: 'modern',    d: 8, ins: 'Viola & piano', src: 'Standard viola literature' },
];

const DOUBLE_BASS_GUITAR = [
  { t: 'Sonata in G minor (Eccles)',   c: 'Henry Eccles',            g: 'sonata',   e: 'solo', era: 'baroque',   d: 6, ins: 'Bass & piano', src: 'Standard bass literature' },
  { t: 'Elephant (Carnival of the Animals)', c: 'Camille Saint-Saëns', g: 'solo',   e: 'solo', era: 'romantic',  d: 4, ins: 'Bass & piano', src: 'Standard bass literature' },
  { t: 'Concerto in E major',          c: 'Karl Ditters von Dittersdorf', g: 'concerto', e: 'solo', era: 'classical', d: 8, ins: 'Bass & orchestra', src: 'Standard bass literature' },
  { t: 'Concerto in F-sharp minor',    c: 'Sergei Koussevitzky',      g: 'concerto', e: 'solo', era: 'modern',    d: 9, ins: 'Bass & orchestra', src: 'Standard bass literature' },
  { t: 'Suite for Solo Bass, BWV 1007 (transcription)', c: 'Johann Sebastian Bach', ar: 'Various', g: 'suite', e: 'solo', era: 'baroque', d: 8, ins: 'Solo bass', src: 'Standard bass literature' },
  { t: 'Recuerdos de la Alhambra',     c: 'Francisco Tárrega',        g: 'solo',     e: 'solo', era: 'romantic',  d: 8, ins: 'Solo classical guitar', src: 'Standard guitar literature' },
  { t: 'Lágrima',                      c: 'Francisco Tárrega',        g: 'solo',     e: 'solo', era: 'romantic',  d: 4, ins: 'Solo classical guitar', src: 'Standard guitar literature' },
  { t: 'Asturias (Leyenda)',           c: 'Isaac Albéniz', ar: 'Various', g: 'solo', e: 'solo', era: 'romantic',  d: 8, ins: 'Solo classical guitar', src: 'Standard guitar literature' },
  { t: 'Cavatina',                     c: 'Stanley Myers',            g: 'solo',     e: 'solo', era: 'contemporary', d: 6, ins: 'Solo classical guitar', src: 'Standard guitar literature' },
  { t: 'Twelve Études',                c: 'Heitor Villa-Lobos',       g: 'étude',    e: 'solo', era: 'modern',    d: 9, ins: 'Solo classical guitar', src: 'Standard guitar literature' },
  { t: 'Sonata Giocosa',               c: 'Joaquín Rodrigo',          g: 'sonata',   e: 'solo', era: 'modern',    d: 8, ins: 'Solo classical guitar', src: 'Standard guitar literature' },
  { t: 'Concierto de Aranjuez',        c: 'Joaquín Rodrigo',          g: 'concerto', e: 'solo', era: 'modern',    d: 9, ins: 'Guitar & orchestra', src: 'Standard guitar literature' },
  { t: 'Recuerdos de la Alhambra',     c: 'Francisco Tárrega',        g: 'solo',     e: 'solo', era: 'romantic',  d: 8, ins: 'Solo classical guitar', src: 'Standard guitar literature' },
];

const PIANO_EXTRA = [
  { t: 'Rhapsody in Blue',             c: 'George Gershwin',           g: 'concerto', e: 'solo', era: 'modern',    d: 9, ins: 'Piano & jazz band/orch', src: 'Standard piano literature' },
  { t: 'Three Preludes',               c: 'George Gershwin',           g: 'solo',     e: 'solo', era: 'modern',    d: 7, ins: 'Solo piano', src: 'Standard piano literature' },
  { t: 'I Got Rhythm Variations',      c: 'George Gershwin',           g: 'variation', e: 'solo', era: 'modern',   d: 9, ins: 'Piano & orch', src: 'Standard piano literature' },
  { t: 'Maple Leaf Rag',               c: 'Scott Joplin',              g: 'ragtime',  e: 'solo', era: 'romantic',  d: 6, ins: 'Solo piano', src: 'Standard piano literature' },
  { t: 'The Entertainer',              c: 'Scott Joplin',              g: 'ragtime',  e: 'solo', era: 'romantic',  d: 5, ins: 'Solo piano', src: 'Standard piano literature' },
  { t: 'Solace',                       c: 'Scott Joplin',              g: 'ragtime',  e: 'solo', era: 'romantic',  d: 5, ins: 'Solo piano', src: 'Standard piano literature' },
  { t: 'Mikrokosmos Vol. 6',           c: 'Béla Bartók',               g: 'method',   e: 'solo', era: 'modern',    d: 7, ins: 'Solo piano', p: 'method book', src: 'Standard piano literature' },
  { t: 'For Children',                 c: 'Béla Bartók',               g: 'solo',     e: 'solo', era: 'modern',    d: 4, ins: 'Solo piano', src: 'Standard piano literature' },
  { t: 'Album for the Young, Op. 68',  c: 'Robert Schumann',           g: 'solo',     e: 'solo', era: 'romantic',  d: 4, ins: 'Solo piano', src: 'Standard piano literature' },
  { t: 'Children\'s Corner',           c: 'Claude Debussy',            g: 'solo',     e: 'solo', era: 'modern',    d: 6, ins: 'Solo piano', src: 'Standard piano literature' },
  { t: 'Hanon: The Virtuoso Pianist',  c: 'Charles-Louis Hanon',       g: 'method',   e: 'solo', era: 'romantic',  d: 4, ins: 'Solo piano', p: 'method book', src: 'Standard piano literature' },
  { t: 'Czerny Op. 299',               c: 'Carl Czerny',               g: 'étude',    e: 'solo', era: 'romantic',  d: 6, ins: 'Solo piano', p: 'method book', src: 'Standard piano literature' },
];

const PERCUSSION = [
  { t: 'Eight Pieces for Four Timpani', c: 'Elliott Carter',           g: 'solo',     e: 'solo', era: 'modern',    d: 9, ins: 'Solo timpani', src: 'Standard percussion literature' },
  { t: 'Frogs',                        c: 'Keiko Abe',                 g: 'solo',     e: 'solo', era: 'contemporary', d: 6, ins: 'Solo marimba', src: 'Standard marimba literature' },
  { t: 'Michi',                        c: 'Keiko Abe',                 g: 'solo',     e: 'solo', era: 'contemporary', d: 8, ins: 'Solo marimba', src: 'Standard marimba literature' },
  { t: 'Two Mexican Dances',           c: 'Gordon Stout',              g: 'solo',     e: 'solo', era: 'modern',    d: 7, ins: 'Solo marimba', src: 'Standard marimba literature' },
  { t: 'Yellow After the Rain',        c: 'Mitchell Peters',           g: 'solo',     e: 'solo', era: 'modern',    d: 5, ins: 'Solo marimba', src: 'Standard marimba literature' },
  { t: 'Etude in C major, Op. 6 No. 10', c: 'Clair Omar Musser',       g: 'étude',    e: 'solo', era: 'modern',    d: 6, ins: 'Solo marimba', src: 'Standard marimba literature' },
  { t: 'Rhythmic Caprice',             c: 'Leigh Howard Stevens',      g: 'solo',     e: 'solo', era: 'modern',    d: 7, ins: 'Solo marimba', src: 'Standard marimba literature' },
  { t: 'Asventuras',                   c: 'Alejandro Viñao',           g: 'solo',     e: 'solo', era: 'contemporary', d: 9, ins: 'Solo marimba', src: 'Standard marimba literature' },
  { t: 'Concerto for Marimba and Strings', c: 'Emmanuel Séjourné',     g: 'concerto', e: 'solo', era: 'contemporary', d: 9, ins: 'Marimba & strings', src: 'Standard marimba literature' },
  { t: 'Variations on Lost Love',      c: 'David Maslanka',            g: 'solo',     e: 'solo', era: 'modern',    d: 8, ins: 'Solo marimba', src: 'Standard marimba literature' },
  { t: 'Six Pieces for Solo Snare Drum', c: 'Jacques Delécluse',       g: 'solo',     e: 'solo', era: 'modern',    d: 8, ins: 'Solo snare drum', src: 'Standard snare literature' },
  { t: 'Twelve Études for Snare Drum', c: 'Jacques Delécluse',         g: 'étude',    e: 'solo', era: 'modern',    d: 7, ins: 'Solo snare drum', p: 'method book', src: 'Standard snare literature' },
  { t: 'Stick Control for the Snare Drummer', c: 'George Lawrence Stone', g: 'method', e: 'solo', era: 'modern',   d: 4, ins: 'Solo snare drum', p: 'method book', src: 'Standard snare literature' },
  { t: 'Portraits in Rhythm',          c: 'Anthony J. Cirone',         g: 'étude',    e: 'solo', era: 'modern',    d: 6, ins: 'Solo snare drum', p: 'method book', src: 'Standard snare literature' },
  { t: 'Ionisation',                   c: 'Edgard Varèse',             g: 'chamber',  e: 'chamber', era: 'modern', d: 9, ins: '13 percussionists', src: 'Standard percussion ensemble literature' },
  { t: 'Living Room Music',            c: 'John Cage',                 g: 'chamber',  e: 'chamber', era: 'modern', d: 7, ins: 'Percussion quartet', src: 'Standard percussion ensemble literature' },
  { t: 'Third Construction',           c: 'John Cage',                 g: 'chamber',  e: 'chamber', era: 'modern', d: 8, ins: 'Percussion quartet', src: 'Standard percussion ensemble literature' },
  { t: 'Toccata',                      c: 'Carlos Chávez',             g: 'chamber',  e: 'chamber', era: 'modern', d: 9, ins: '6 percussionists', src: 'Standard percussion ensemble literature' },
  { t: 'Rhythmic Suite',               c: 'Saul Goodman',              g: 'solo',     e: 'solo', era: 'modern',    d: 7, ins: 'Solo timpani', src: 'Standard timpani literature' },
];

const VOCAL_SOLO = [
  // Soprano
  { t: 'O mio babbino caro',           c: 'Giacomo Puccini',           g: 'aria', e: 'voice', era: 'romantic',  d: 6, l: 'Italian', n: 'Soprano aria from Gianni Schicchi.', src: 'Standard vocal literature' },
  { t: 'Quando me\'n vo (Musetta\'s Waltz)', c: 'Giacomo Puccini',     g: 'aria', e: 'voice', era: 'romantic',  d: 7, l: 'Italian', n: 'Soprano aria from La Bohème.', src: 'Standard vocal literature' },
  { t: 'Mi chiamano Mimì',             c: 'Giacomo Puccini',           g: 'aria', e: 'voice', era: 'romantic',  d: 7, l: 'Italian', n: 'Soprano.', src: 'Standard vocal literature' },
  { t: 'Caro mio ben',                 c: 'Giuseppe Giordani',          g: 'arietta', e: 'voice', era: 'classical', d: 4, l: 'Italian', n: 'Standard 24 Italian Songs.', src: '24 Italian Songs and Arias' },
  { t: 'Sebben, crudele',              c: 'Antonio Caldara',            g: 'arietta', e: 'voice', era: 'baroque',   d: 4, l: 'Italian', src: '24 Italian Songs and Arias' },
  { t: 'Vergin, tutto amor',           c: 'Francesco Durante',          g: 'arietta', e: 'voice', era: 'baroque',   d: 4, l: 'Italian', src: '24 Italian Songs and Arias' },
  { t: 'Le Violette',                  c: 'Alessandro Scarlatti',       g: 'arietta', e: 'voice', era: 'baroque',   d: 4, l: 'Italian', src: '24 Italian Songs and Arias' },
  { t: 'Ich liebe dich',               c: 'Ludwig van Beethoven',       g: 'art song', e: 'voice', era: 'classical', d: 4, l: 'German', src: 'Standard vocal literature' },
  { t: 'An die Musik',                 c: 'Franz Schubert',             g: 'art song', e: 'voice', era: 'romantic',  d: 5, l: 'German', src: 'Standard vocal literature' },
  { t: 'Ave Maria',                    c: 'Franz Schubert',             g: 'art song', e: 'voice', era: 'romantic',  d: 5, l: 'Latin', src: 'Standard vocal literature' },
  { t: 'Du bist die Ruh',              c: 'Franz Schubert',             g: 'art song', e: 'voice', era: 'romantic',  d: 6, l: 'German', src: 'Standard vocal literature' },
  { t: 'Gretchen am Spinnrade',        c: 'Franz Schubert',             g: 'art song', e: 'voice', era: 'romantic',  d: 7, l: 'German', src: 'Standard vocal literature' },
  { t: 'Widmung',                      c: 'Robert Schumann',            g: 'art song', e: 'voice', era: 'romantic',  d: 6, l: 'German', src: 'Standard vocal literature' },
  // Mezzo / Alto
  { t: 'Mon coeur s\'ouvre à ta voix', c: 'Camille Saint-Saëns',         g: 'aria', e: 'voice', era: 'romantic',  d: 8, l: 'French', n: 'From Samson et Dalila; mezzo.', src: 'Standard vocal literature' },
  { t: 'Habanera',                     c: 'Georges Bizet',               g: 'aria', e: 'voice', era: 'romantic',  d: 6, l: 'French', n: 'From Carmen; mezzo.', src: 'Standard vocal literature' },
  { t: 'Voi che sapete',               c: 'Wolfgang Amadeus Mozart',     g: 'aria', e: 'voice', era: 'classical', d: 6, l: 'Italian', n: 'From Le nozze di Figaro; mezzo.', src: 'Standard vocal literature' },
  { t: 'Una voce poco fa',             c: 'Gioachino Rossini',           g: 'aria', e: 'voice', era: 'romantic',  d: 9, l: 'Italian', n: 'From Il barbiere; mezzo coloratura.', src: 'Standard vocal literature' },
  { t: 'O del mio dolce ardor',        c: 'Christoph Willibald Gluck',   g: 'aria', e: 'voice', era: 'classical', d: 6, l: 'Italian', src: 'Standard vocal literature' },
  // Tenor
  { t: 'Nessun dorma',                 c: 'Giacomo Puccini',             g: 'aria', e: 'voice', era: 'romantic',  d: 9, l: 'Italian', n: 'From Turandot; dramatic tenor.', src: 'Standard vocal literature' },
  { t: 'La donna è mobile',            c: 'Giuseppe Verdi',              g: 'aria', e: 'voice', era: 'romantic',  d: 7, l: 'Italian', n: 'From Rigoletto; tenor.', src: 'Standard vocal literature' },
  { t: 'Che gelida manina',            c: 'Giacomo Puccini',             g: 'aria', e: 'voice', era: 'romantic',  d: 8, l: 'Italian', n: 'From La Bohème; tenor.', src: 'Standard vocal literature' },
  { t: 'Una furtiva lagrima',          c: 'Gaetano Donizetti',           g: 'aria', e: 'voice', era: 'romantic',  d: 8, l: 'Italian', n: 'From L\'elisir d\'amore; lyric tenor.', src: 'Standard vocal literature' },
  { t: 'Lonely House',                 c: 'Kurt Weill',                  g: 'art song', e: 'voice', era: 'modern', d: 6, l: 'English', n: 'From Street Scene.', src: 'Standard vocal literature' },
  // Baritone / Bass
  { t: 'Largo al factotum',            c: 'Gioachino Rossini',           g: 'aria', e: 'voice', era: 'romantic',  d: 9, l: 'Italian', n: 'From Il barbiere; baritone patter.', src: 'Standard vocal literature' },
  { t: 'Catalogue Aria (Madamina)',    c: 'Wolfgang Amadeus Mozart',     g: 'aria', e: 'voice', era: 'classical', d: 7, l: 'Italian', n: 'From Don Giovanni; bass-baritone.', src: 'Standard vocal literature' },
  { t: 'Non più andrai',               c: 'Wolfgang Amadeus Mozart',     g: 'aria', e: 'voice', era: 'classical', d: 6, l: 'Italian', n: 'From Le nozze di Figaro; baritone.', src: 'Standard vocal literature' },
  { t: 'Avant de quitter ces lieux',   c: 'Charles Gounod',              g: 'aria', e: 'voice', era: 'romantic',  d: 8, l: 'French', n: 'From Faust; baritone.', src: 'Standard vocal literature' },
  { t: 'Sois immobile',                c: 'Gioachino Rossini',           g: 'aria', e: 'voice', era: 'romantic',  d: 7, l: 'French', n: 'From Guillaume Tell; baritone.', src: 'Standard vocal literature' },
  // English art song
  { t: 'The Vagabond',                 c: 'Ralph Vaughan Williams',      g: 'art song', e: 'voice', era: 'modern', d: 6, l: 'English', n: 'From Songs of Travel.', src: 'Standard vocal literature' },
  { t: 'The Roadside Fire',            c: 'Ralph Vaughan Williams',      g: 'art song', e: 'voice', era: 'modern', d: 5, l: 'English', src: 'Standard vocal literature' },
  { t: 'Silent Noon',                  c: 'Ralph Vaughan Williams',      g: 'art song', e: 'voice', era: 'modern', d: 6, l: 'English', src: 'Standard vocal literature' },
  { t: 'O Waly, Waly',                 c: 'Traditional', ar: 'Benjamin Britten', g: 'folk song', e: 'voice', era: 'folk', d: 5, l: 'English', src: 'Standard vocal literature' },
  { t: 'The Salley Gardens',           c: 'Traditional', ar: 'Benjamin Britten', g: 'folk song', e: 'voice', era: 'folk', d: 5, l: 'English', src: 'Standard vocal literature' },
];

const WORLD_FOLK = [
  { t: 'Danny Boy',                    c: 'Traditional', ar: 'Various',          g: 'folk', e: 'voice', era: 'folk', d: 4, l: 'English', src: 'Folk canon' },
  { t: 'Loch Lomond',                  c: 'Traditional', ar: 'Various',          g: 'folk', e: 'choir', era: 'folk', d: 4, l: 'English', src: 'Folk canon' },
  { t: 'Shenandoah',                   c: 'Traditional', ar: 'James Erb',        g: 'folk', e: 'choir', era: 'folk', d: 5, l: 'English', src: 'Folk canon' },
  { t: 'Greensleeves',                 c: 'Traditional', ar: 'Various',          g: 'folk', e: 'voice', era: 'folk', d: 3, l: 'English', src: 'Folk canon' },
  { t: 'Scarborough Fair',             c: 'Traditional', ar: 'Various',          g: 'folk', e: 'voice', era: 'folk', d: 4, l: 'English', src: 'Folk canon' },
  { t: 'La Cumparsita',                c: 'Gerardo Matos Rodríguez',           g: 'tango', e: 'chamber', era: 'modern', d: 6, src: 'Tango canon' },
  { t: 'Por una Cabeza',               c: 'Carlos Gardel',                      g: 'tango', e: 'chamber', era: 'modern', d: 5, src: 'Tango canon' },
  { t: 'Libertango',                   c: 'Astor Piazzolla',                    g: 'nuevo tango', e: 'chamber', era: 'modern', d: 7, src: 'Tango canon' },
  { t: 'Adiós Nonino',                 c: 'Astor Piazzolla',                    g: 'nuevo tango', e: 'chamber', era: 'modern', d: 7, src: 'Tango canon' },
  { t: 'Oblivion',                     c: 'Astor Piazzolla',                    g: 'nuevo tango', e: 'chamber', era: 'modern', d: 7, src: 'Tango canon' },
  { t: 'Histoire du Tango',            c: 'Astor Piazzolla',                    g: 'nuevo tango', e: 'chamber', era: 'modern', d: 8, ins: 'Flute & guitar', src: 'Tango canon' },
  { t: 'Tico-Tico no Fubá',            c: 'Zequinha de Abreu',                  g: 'choro', e: 'chamber', era: 'modern', d: 7, src: 'Brazilian canon' },
  { t: 'Aquarela do Brasil',           c: 'Ary Barroso',                        g: 'samba', e: 'chamber', era: 'modern', d: 6, src: 'Brazilian canon' },
  { t: 'Chega de Saudade',             c: 'Antônio Carlos Jobim',               g: 'bossa nova', e: 'chamber', era: 'jazz', d: 6, src: 'Brazilian canon' },
  { t: 'Cielito Lindo',                c: 'Quirino Mendoza y Cortés',           g: 'folk', e: 'voice', era: 'folk', d: 3, l: 'Spanish', src: 'Latin folk' },
  { t: 'La Bamba',                     c: 'Traditional', ar: 'Various',         g: 'folk', e: 'band', era: 'folk', d: 4, l: 'Spanish', src: 'Latin folk' },
  { t: 'Sakura, Sakura',               c: 'Traditional', ar: 'Various',         g: 'folk', e: 'voice', era: 'folk', d: 3, l: 'Japanese', src: 'World folk' },
  { t: 'Arirang',                      c: 'Traditional', ar: 'Various',         g: 'folk', e: 'voice', era: 'folk', d: 4, l: 'Korean', src: 'World folk' },
  { t: 'Hava Nagila',                  c: 'Traditional', ar: 'Various',         g: 'folk', e: 'voice', era: 'folk', d: 4, l: 'Hebrew', src: 'World folk' },
  { t: 'Hatikvah',                     c: 'Samuel Cohen',                       g: 'national', e: 'voice', era: 'romantic', d: 4, l: 'Hebrew', src: 'World folk' },
  { t: 'Siyahamba',                    c: 'Traditional', ar: 'Various',         g: 'folk', e: 'choir', era: 'folk', d: 3, l: 'Zulu', src: 'World folk' },
  { t: 'Shosholoza',                   c: 'Traditional', ar: 'Various',         g: 'folk', e: 'choir', era: 'folk', d: 4, l: 'Zulu', src: 'World folk' },
  { t: 'Bashana Haba\'ah',             c: 'Nurit Hirsh',                        g: 'folk', e: 'voice', era: 'modern', d: 4, l: 'Hebrew', src: 'World folk' },
];

// ── End of curated lists ────────────────────────────────────────────────────

const ALL_SECTIONS = [
  { name: 'Jazz standards',         rows: JAZZ_STANDARDS },
  { name: 'Musical theater',        rows: MUSICAL_THEATER },
  { name: 'Sacred / choral',        rows: SACRED_CHORAL },
  { name: 'Spirituals',             rows: SPIRITUALS },
  { name: 'Wind ensemble',          rows: WIND_BAND },
  { name: 'Marches',                rows: MARCHES },
  { name: 'Brass chamber',          rows: BRASS_CHAMBER },
  { name: 'Woodwind chamber',       rows: WOODWIND_CHAMBER },
  { name: 'Trumpet',                rows: TRUMPET },
  { name: 'Trombone',               rows: TROMBONE },
  { name: 'Horn',                   rows: HORN },
  { name: 'Flute',                  rows: FLUTE },
  { name: 'Clarinet',               rows: CLARINET },
  { name: 'Oboe and bassoon',       rows: OBOE_BASSOON },
  { name: 'Saxophone',              rows: SAXOPHONE },
  { name: 'Violin / viola / cello', rows: VIOLIN_VIOLA_CELLO },
  { name: 'Double bass and guitar', rows: DOUBLE_BASS_GUITAR },
  { name: 'Piano (extra)',          rows: PIANO_EXTRA },
  { name: 'Percussion',             rows: PERCUSSION },
  { name: 'Vocal solo',             rows: VOCAL_SOLO },
  { name: 'World and folk',         rows: WORLD_FOLK },
];

async function pieceExists(title, composer) {
  const res = await pool.query(
    `SELECT 1 FROM pieces
       WHERE LOWER(title) = LOWER($1) AND LOWER(composer) = LOWER($2)
       LIMIT 1`,
    [title, composer]
  );
  return res.rowCount > 0;
}

async function insertRow(row) {
  await pool.query(
    `INSERT INTO pieces
       (id, title, alternate_title, composer, arranger, genre, difficulty_level,
        ensemble_type, instrumentation, musical_key, language, era,
        purpose, performance_notes, source_reference)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
    [
      randomUUID(),
      row.t,
      row.alt || null,
      row.c || null,
      row.ar || null,
      row.g || null,
      row.d || null,
      row.e || null,
      row.ins || null,
      row.k || null,
      row.l || null,
      row.era || null,
      row.p || 'concert',
      row.n || null,
      row.src || 'Curated educational rep',
    ]
  );
}

async function main() {
  console.log('Connecting to database...');
  await pool.query('SELECT 1');

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const section of ALL_SECTIONS) {
    console.log(`\n▸ ${section.name}  (${section.rows.length} candidates)`);
    for (const row of section.rows) {
      try {
        if (await pieceExists(row.t, row.c || '')) {
          skipped++;
          continue;
        }
        await insertRow(row);
        inserted++;
        console.log(`  [+] ${row.t} — ${row.c || 'Traditional'}`);
      } catch (e) {
        errors++;
        console.warn(`  [!] ${row.t}: ${e.message}`);
      }
    }
  }

  console.log('\n─────────────────────────────────────────');
  console.log(`Done.`);
  console.log(`  Inserted : ${inserted}`);
  console.log(`  Skipped  : ${skipped} (already in DB)`);
  console.log(`  Errors   : ${errors}`);
  console.log(`  Sections : ${ALL_SECTIONS.length}`);
  console.log('─────────────────────────────────────────');

  await pool.end();
}

main().catch((e) => {
  console.error('\nFatal error:', e.message);
  process.exit(1);
});
