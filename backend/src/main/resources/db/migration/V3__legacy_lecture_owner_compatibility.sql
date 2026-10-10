-- A baselined VM schema may require professor_id as well as the API's owner_id.
-- Keep the legacy column and its constraints, and fill both IDs on new inserts.
DO $migration$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'lectures' AND column_name = 'professor_id'
    ) THEN
        UPDATE lectures SET owner_id = professor_id WHERE owner_id IS NULL;

        EXECUTE $function$
            CREATE OR REPLACE FUNCTION fill_legacy_lecture_owner() RETURNS trigger
            LANGUAGE plpgsql AS $body$
            BEGIN
                NEW.owner_id := COALESCE(NEW.owner_id, NEW.professor_id);
                NEW.professor_id := COALESCE(NEW.professor_id, NEW.owner_id);
                RETURN NEW;
            END
            $body$
        $function$;

        DROP TRIGGER IF EXISTS lectures_fill_legacy_owner ON lectures;
        CREATE TRIGGER lectures_fill_legacy_owner
            BEFORE INSERT ON lectures
            FOR EACH ROW EXECUTE FUNCTION fill_legacy_lecture_owner();
    END IF;
END
$migration$;
