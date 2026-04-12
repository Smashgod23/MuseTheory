-- Muse Theory database schema
-- 8 normalized tables supporting the full MVP flow

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table 1: Instruments (no foreign keys, referenced by others)
CREATE TABLE instruments (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(100) NOT NULL UNIQUE,
    type        VARCHAR(50)  NOT NULL,
    range_low   VARCHAR(20),
    range_high  VARCHAR(20),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Table 2: Teachers (depends on users, but created first for FK from users)
-- We create teachers first without the user FK, then add it after users exist.
-- Actually, teachers references users and users references teachers, so we break the cycle:
-- Create both tables without FKs first, then add the constraints.

CREATE TABLE teachers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID,
    institution     VARCHAR(255),
    specialization  VARCHAR(255),
    bio             TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table 3: Users
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    role            VARCHAR(20)  NOT NULL DEFAULT 'STUDENT',
    skill_level     VARCHAR(20),
    musical_goals   TEXT,
    teacher_id      UUID REFERENCES teachers(id) ON DELETE SET NULL,
    instrument_id   UUID REFERENCES instruments(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Now add the user FK to teachers
ALTER TABLE teachers
    ADD CONSTRAINT fk_teachers_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE teachers
    ADD CONSTRAINT uq_teachers_user_id UNIQUE (user_id);

ALTER TABLE teachers
    ALTER COLUMN user_id SET NOT NULL;

-- Table 4: Pieces
CREATE TABLE pieces (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title           VARCHAR(255) NOT NULL,
    composer        VARCHAR(255),
    genre           VARCHAR(100),
    difficulty_level INTEGER,
    score_url       VARCHAR(512),
    midi_ref_url    VARCHAR(512),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table 5: Piece Parameters (expressive map per piece + instrument)
CREATE TABLE piece_parameters (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    piece_id             UUID NOT NULL REFERENCES pieces(id) ON DELETE CASCADE,
    instrument_id        UUID NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
    repetition_map       TEXT,
    harmonic_tension_map TEXT,
    text_stress_map      TEXT,
    director_notes       TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (piece_id, instrument_id)
);

-- Table 6: Performances
CREATE TABLE performances (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    piece_id         UUID NOT NULL REFERENCES pieces(id) ON DELETE CASCADE,
    instrument_id    UUID NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
    audio_url        VARCHAR(512),
    duration_seconds DOUBLE PRECISION,
    recorded_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table 7: Feature Vectors (one row per performance, ML model input)
CREATE TABLE feature_vectors (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    performance_id          UUID NOT NULL UNIQUE REFERENCES performances(id) ON DELETE CASCADE,
    tempo_mean              DOUBLE PRECISION,
    tempo_variance          DOUBLE PRECISION,
    dynamic_range           DOUBLE PRECISION,
    rms_energy_contour      TEXT,
    pitch_mean              DOUBLE PRECISION,
    pitch_stability         DOUBLE PRECISION,
    vibrato_rate            DOUBLE PRECISION,
    vibrato_extent          DOUBLE PRECISION,
    spectral_centroid_mean  DOUBLE PRECISION,
    mfcc_summary            TEXT,
    onset_density           DOUBLE PRECISION,
    articulation_style      DOUBLE PRECISION,
    contrast_score          DOUBLE PRECISION,
    phrase_length_variance  DOUBLE PRECISION,
    breath_placement        TEXT,
    harmonic_deviation      DOUBLE PRECISION,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table 8: Performances Feedback (AI + human feedback, training data store)
CREATE TABLE performances_feedback (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    performance_id   UUID NOT NULL REFERENCES performances(id) ON DELETE CASCADE,
    source           VARCHAR(10) NOT NULL CHECK (source IN ('AI', 'HUMAN')),
    suggestion_text  TEXT,
    musicality_score DOUBLE PRECISION,
    rating           INTEGER CHECK (rating >= 1 AND rating <= 5),
    measure_start    INTEGER,
    measure_end      INTEGER,
    feature_targeted VARCHAR(100),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_teacher ON users(teacher_id);
CREATE INDEX idx_performances_user ON performances(user_id);
CREATE INDEX idx_performances_piece ON performances(piece_id);
CREATE INDEX idx_performances_created ON performances(created_at DESC);
CREATE INDEX idx_feature_vectors_performance ON feature_vectors(performance_id);
CREATE INDEX idx_feedback_performance ON performances_feedback(performance_id);
CREATE INDEX idx_feedback_source ON performances_feedback(source);
CREATE INDEX idx_piece_params_piece ON piece_parameters(piece_id);
