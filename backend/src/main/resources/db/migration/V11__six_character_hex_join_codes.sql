-- Public invitations use six hexadecimal characters; lecture IDs stay numeric.
ALTER TABLE lectures ALTER COLUMN join_code
    SET DEFAULT upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));

-- Replace the old eight-character codes without changing lecture relationships.
-- The existing unique index also protects against random-code collisions.
DO $$
DECLARE
    lecture_row RECORD;
    attempts INTEGER;
BEGIN
    FOR lecture_row IN SELECT id FROM lectures WHERE join_code !~ '^[0-9A-F]{6}$' ORDER BY id LOOP
        attempts := 0;
        LOOP
            attempts := attempts + 1;
            BEGIN
                UPDATE lectures SET join_code = DEFAULT WHERE id = lecture_row.id;
                EXIT;
            EXCEPTION WHEN unique_violation THEN
                IF attempts >= 100 THEN
                    RAISE EXCEPTION 'Could not allocate a unique join code for lecture %', lecture_row.id;
                END IF;
            END;
        END LOOP;
    END LOOP;
END $$;

ALTER TABLE lectures ADD CONSTRAINT lectures_join_code_format
    CHECK (join_code ~ '^[0-9A-F]{6}$');
