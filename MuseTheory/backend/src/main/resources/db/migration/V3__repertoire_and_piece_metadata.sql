-- V3: extend pieces with performer-facing metadata and add repertoire workspace tables.

-- Extend the pieces catalog with the fields a performer actually cares about
-- before picking up a score.
ALTER TABLE pieces
    ADD COLUMN alternate_title   VARCHAR(255),
    ADD COLUMN arranger          VARCHAR(255),
    ADD COLUMN ensemble_type     VARCHAR(50),
    ADD COLUMN instrumentation   TEXT,
    ADD COLUMN language          VARCHAR(50),
    ADD COLUMN musical_key       VARCHAR(50),
    ADD COLUMN era               VARCHAR(50),
    ADD COLUMN duration_seconds  INTEGER,
    ADD COLUMN purpose           VARCHAR(255),
    ADD COLUMN performance_notes TEXT,
    ADD COLUMN source_reference  VARCHAR(255),
    ADD COLUMN sheet_music_url   VARCHAR(512);

-- Indexes for the partial-match search. btree on LOWER(col) is plenty for
-- a catalog in the low thousands; upgrade to pg_trgm later if it gets slow.
CREATE INDEX idx_pieces_title_lower    ON pieces (LOWER(title));
CREATE INDEX idx_pieces_composer_lower ON pieces (LOWER(composer));
CREATE INDEX idx_pieces_arranger_lower ON pieces (LOWER(arranger));
CREATE INDEX idx_pieces_ensemble_type  ON pieces (LOWER(ensemble_type));
CREATE INDEX idx_pieces_difficulty     ON pieces (difficulty_level);

-- A student's personal repertoire. One row per (user, piece).
CREATE TABLE repertoire_entries (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    piece_id    UUID NOT NULL REFERENCES pieces(id) ON DELETE CASCADE,
    status      VARCHAR(32) NOT NULL DEFAULT 'NEW'
                  CHECK (status IN ('NEW', 'LEARNING', 'POLISHING', 'PERFORMANCE_READY')),
    goals       TEXT,
    notes       TEXT,
    added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, piece_id)
);

CREATE INDEX idx_repertoire_user  ON repertoire_entries (user_id);
CREATE INDEX idx_repertoire_piece ON repertoire_entries (piece_id);

-- Practice log entries attached to a repertoire item.
CREATE TABLE practice_sessions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    repertoire_entry_id UUID NOT NULL REFERENCES repertoire_entries(id) ON DELETE CASCADE,
    duration_minutes    INTEGER NOT NULL CHECK (duration_minutes > 0 AND duration_minutes <= 1440),
    notes               TEXT,
    practiced_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_practice_entry ON practice_sessions (repertoire_entry_id);
CREATE INDEX idx_practice_date  ON practice_sessions (practiced_at DESC);

-- Backfill the three existing seeded pieces with realistic performer metadata.
UPDATE pieces SET
    ensemble_type      = 'choir',
    instrumentation    = 'SATB choir, organ',
    language           = 'Latin',
    musical_key        = 'E minor',
    era                = 'baroque',
    duration_seconds   = 240,
    purpose            = 'concert',
    performance_notes  = 'Focus on the suspensions and text painting on "crucifixus." Release consonants together.'
WHERE title = 'Crucifixus';

UPDATE pieces SET
    ensemble_type      = 'solo',
    instrumentation    = 'solo voice, piano',
    language           = 'Latin',
    musical_key        = 'Bb major',
    era                = 'romantic',
    duration_seconds   = 300,
    purpose            = 'concert',
    performance_notes  = 'Shape each "Ave Maria" differently. Avoid a uniform crescendo across all statements.'
WHERE title = 'Ave Maria';

UPDATE pieces SET
    ensemble_type      = 'solo',
    instrumentation    = 'solo piano',
    musical_key        = 'Db major',
    era                = 'late romantic',
    duration_seconds   = 330,
    purpose            = 'concert',
    performance_notes  = 'Inner voices must breathe. Do not rush the ascending line in measure 27.'
WHERE title = 'Clair de Lune';

-- A few extra seeded pieces across ensemble types so search is interesting.
INSERT INTO pieces (id, title, alternate_title, composer, arranger, genre, difficulty_level,
                    ensemble_type, instrumentation, language, musical_key, era,
                    duration_seconds, purpose, performance_notes) VALUES
    ('b2c3d4e5-0001-4000-8000-000000000004', 'Eine kleine Nachtmusik', 'Serenade No. 13 in G',
     'Wolfgang Amadeus Mozart', NULL, 'serenade', 4,
     'orchestra', 'string orchestra', 'German', 'G major', 'classical',
     360, 'concert', 'Keep the allegro buoyant, not rushed. Observe the dynamic drop before the recap.'),
    ('b2c3d4e5-0001-4000-8000-000000000005', 'Sing, Sing, Sing', NULL,
     'Louis Prima', 'Benny Goodman', 'swing', 4,
     'band', 'big band with featured drum kit', 'English', 'A minor', 'modern',
     540, 'concert', 'The tom groove sets the whole arc. Drums own the piece.'),
    ('b2c3d4e5-0001-4000-8000-000000000006', 'O Magnum Mysterium', NULL,
     'Tomas Luis de Victoria', NULL, 'sacred motet', 3,
     'choir', 'SATB choir a cappella', 'Latin', 'F major', 'renaissance',
     240, 'liturgy', 'Blend over volume. Breathe with the phrase, not the bar line.');
