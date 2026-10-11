-- Retain course identities and snapshots when a professor changes their profile.
ALTER TABLE professor_courses ADD COLUMN archived BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE professor_courses DROP CONSTRAINT professor_courses_user_id_position_key;
DROP INDEX professor_course_names;
CREATE UNIQUE INDEX professor_course_names ON professor_courses (user_id, lower(title)) WHERE NOT archived;
CREATE UNIQUE INDEX professor_course_positions ON professor_courses (user_id, position) WHERE NOT archived;
ALTER TABLE lectures ADD COLUMN course_id TEXT;
ALTER TABLE lectures ADD CONSTRAINT lectures_course_fk
    FOREIGN KEY (owner_id, course_id) REFERENCES professor_courses(user_id, id);
CREATE INDEX lectures_course_idx ON lectures(owner_id, course_id);
-- Earlier profiles replaced course rows and names could be reused. A matching
-- label is not proof of identity. Leave legacy associations null; the UI keeps
-- each such session accessible in a clearly identified legacy course entry.
