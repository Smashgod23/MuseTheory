-- Application inserts now generate RFC 9562 UUIDv7 ids in Java (UuidV7Generator) before
-- the INSERT is sent, so this default rarely fires. It exists as a fallback for any insert
-- that omits id (raw SQL, manual psql), so that path can't silently hand out UUIDv4 again.
-- Postgres 16 has no native uuidv7(), so this builds one from pgcrypto's gen_random_bytes:
-- bytes 0-5 = unix_ts_ms big-endian, byte 6 high nibble = version 7, byte 8 top 2 bits = variant 10.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION uuid_generate_v7()
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    ts_ms      bigint := floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint;
    ts_bytes   bytea  := substring(int8send(ts_ms) FROM 3 FOR 6);
    rand_bytes bytea  := gen_random_bytes(10);
    uuid_bytes bytea;
BEGIN
    uuid_bytes := ts_bytes || rand_bytes;
    uuid_bytes := set_byte(uuid_bytes, 6, 112 | (get_byte(uuid_bytes, 6) & 15));
    uuid_bytes := set_byte(uuid_bytes, 8, 128 | (get_byte(uuid_bytes, 8) & 63));
    RETURN encode(uuid_bytes, 'hex')::uuid;
END;
$$;

ALTER TABLE instruments            ALTER COLUMN id SET DEFAULT uuid_generate_v7();
ALTER TABLE teachers               ALTER COLUMN id SET DEFAULT uuid_generate_v7();
ALTER TABLE users                  ALTER COLUMN id SET DEFAULT uuid_generate_v7();
ALTER TABLE pieces                 ALTER COLUMN id SET DEFAULT uuid_generate_v7();
ALTER TABLE piece_parameters       ALTER COLUMN id SET DEFAULT uuid_generate_v7();
ALTER TABLE performances           ALTER COLUMN id SET DEFAULT uuid_generate_v7();
ALTER TABLE feature_vectors        ALTER COLUMN id SET DEFAULT uuid_generate_v7();
ALTER TABLE performances_feedback  ALTER COLUMN id SET DEFAULT uuid_generate_v7();
ALTER TABLE repertoire_entries     ALTER COLUMN id SET DEFAULT uuid_generate_v7();
ALTER TABLE practice_sessions      ALTER COLUMN id SET DEFAULT uuid_generate_v7();
