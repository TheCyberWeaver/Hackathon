CREATE TABLE users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    eth_identity_ref TEXT NOT NULL UNIQUE CHECK (btrim(eth_identity_ref) <> ''),
    role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'professor', 'admin'))
);
CREATE TABLE lectures (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title TEXT NOT NULL CHECK (btrim(title) <> ''),
    lecture_time TIMESTAMPTZ NOT NULL
);
CREATE TABLE questions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    lecture_id BIGINT NOT NULL REFERENCES lectures(id) ON DELETE RESTRICT,
    author_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    text TEXT NOT NULL CHECK (btrim(text) <> ''),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'unanswered' CHECK (status IN ('unanswered', 'answered')),
    answered_at TIMESTAMPTZ,
    CONSTRAINT one_question_per_student_per_lecture UNIQUE (lecture_id, author_id),
    CONSTRAINT answer_status_matches_time CHECK (
        (status = 'unanswered' AND answered_at IS NULL)
        OR (status = 'answered' AND answered_at IS NOT NULL)
    )
);
CREATE INDEX questions_lecture_submitted_at_idx ON questions (lecture_id, submitted_at);
