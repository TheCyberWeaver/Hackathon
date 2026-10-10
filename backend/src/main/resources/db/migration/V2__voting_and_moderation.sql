ALTER TABLE lectures ADD COLUMN owner_id BIGINT REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE questions ADD COLUMN selected BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE questions ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE questions ADD CONSTRAINT selected_question_is_unanswered CHECK (NOT selected OR status = 'unanswered');
CREATE TABLE question_votes (
    question_id BIGINT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    PRIMARY KEY (question_id, user_id)
);
CREATE TABLE question_reports (
    question_id BIGINT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reported_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (question_id, user_id)
);
CREATE INDEX lectures_time_idx ON lectures (lecture_time DESC, id DESC);
