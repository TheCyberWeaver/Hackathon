ALTER TABLE lectures ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE lectures ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
ALTER TABLE lectures ADD COLUMN questions_paused BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE lectures ADD COLUMN course TEXT NOT NULL DEFAULT '';
-- Preserve existing pools as started sessions when adopting session controls.
UPDATE lectures SET started_at = lecture_time WHERE started_at IS NULL;
ALTER TABLE lectures ADD CONSTRAINT ended_lecture_was_started CHECK (ended_at IS NULL OR started_at IS NOT NULL);
ALTER TABLE questions ADD COLUMN answer TEXT;
ALTER TABLE questions ADD CONSTRAINT question_answer_nonblank CHECK (answer IS NULL OR btrim(answer) <> '');
ALTER TABLE questions ADD CONSTRAINT written_answer_requires_answered_status CHECK (answer IS NULL OR status = 'answered');
-- Older VM schemas retained a votes table whose restrictive FK blocks trash purging.
DO $migration$
BEGIN
    IF to_regclass(current_schema() || '.votes') IS NOT NULL THEN
        ALTER TABLE votes DROP CONSTRAINT IF EXISTS votes_question_id_fkey;
        ALTER TABLE votes ADD CONSTRAINT votes_question_id_fkey
            FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE;
    END IF;
END
$migration$;
