-- Old trash is permanently removed before retiring soft deletion.
-- Question-specific foreign keys cascade to votes and reports (including legacy votes).
DELETE FROM questions WHERE deleted_at IS NOT NULL;
ALTER TABLE questions DROP COLUMN answer;
ALTER TABLE questions DROP COLUMN deleted_at;

CREATE TABLE professor_profiles (
    user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
    revision BIGINT NOT NULL DEFAULT 0
);
CREATE TABLE professor_courses (
    user_id BIGINT NOT NULL REFERENCES professor_profiles(user_id) ON DELETE CASCADE,
    id TEXT NOT NULL CHECK (length(id) BETWEEN 1 AND 200),
    title TEXT NOT NULL CHECK (title = btrim(title) AND length(title) BETWEEN 1 AND 120),
    position INTEGER NOT NULL CHECK (position >= 0),
    PRIMARY KEY (user_id, id),
    UNIQUE (user_id, position)
);
CREATE UNIQUE INDEX professor_course_names ON professor_courses (user_id, lower(title));
-- Courses deliberately have no foreign key from lectures: lecture names are snapshots.
