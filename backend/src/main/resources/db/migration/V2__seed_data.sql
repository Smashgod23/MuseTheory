-- Seed data: instruments commonly used in choral and instrumental music education

INSERT INTO instruments (id, name, type, range_low, range_high) VALUES
    ('a1b2c3d4-0001-4000-8000-000000000001', 'Soprano Voice', 'voice', 'C4', 'C6'),
    ('a1b2c3d4-0001-4000-8000-000000000002', 'Alto Voice', 'voice', 'F3', 'F5'),
    ('a1b2c3d4-0001-4000-8000-000000000003', 'Tenor Voice', 'voice', 'C3', 'C5'),
    ('a1b2c3d4-0001-4000-8000-000000000004', 'Bass Voice', 'voice', 'E2', 'E4'),
    ('a1b2c3d4-0001-4000-8000-000000000005', 'Piano', 'keyboard', 'A0', 'C8'),
    ('a1b2c3d4-0001-4000-8000-000000000006', 'Violin', 'string', 'G3', 'A7'),
    ('a1b2c3d4-0001-4000-8000-000000000007', 'Cello', 'string', 'C2', 'E6'),
    ('a1b2c3d4-0001-4000-8000-000000000008', 'Flute', 'woodwind', 'C4', 'D7'),
    ('a1b2c3d4-0001-4000-8000-000000000009', 'Clarinet', 'woodwind', 'E3', 'C7'),
    ('a1b2c3d4-0001-4000-8000-000000000010', 'Trumpet', 'brass', 'F#3', 'D6');

-- Seed data: a few sample pieces for testing
INSERT INTO pieces (id, title, composer, genre, difficulty_level) VALUES
    ('b2c3d4e5-0001-4000-8000-000000000001', 'Crucifixus', 'Antonio Lotti', 'choral sacred', 3),
    ('b2c3d4e5-0001-4000-8000-000000000002', 'Ave Maria', 'Franz Schubert', 'art song', 4),
    ('b2c3d4e5-0001-4000-8000-000000000003', 'Clair de Lune', 'Claude Debussy', 'solo piano', 5);
