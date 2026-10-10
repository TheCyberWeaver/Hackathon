CREATE TABLE question_moderation_warnings (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    lecture_id BIGINT NOT NULL REFERENCES lectures(id) ON DELETE RESTRICT,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reason TEXT NOT NULL CHECK (reason IN ('blacklisted_word')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX question_moderation_warnings_user_lecture_idx
    ON question_moderation_warnings (user_id, lecture_id, created_at);
