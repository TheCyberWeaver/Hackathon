-- Legacy questions remain deletable by their authors. PostgreSQL's cryptographic
-- UUID generator supplies entropy for migration-only, ephemeral token material.
ALTER TABLE questions ADD COLUMN deletion_token_hash BYTEA;
UPDATE questions
SET deletion_token_hash = sha256(convert_to(gen_random_uuid()::text || gen_random_uuid()::text, 'UTF8'));
ALTER TABLE questions ALTER COLUMN deletion_token_hash SET NOT NULL;
ALTER TABLE questions ADD CONSTRAINT questions_deletion_token_hash_length
    CHECK (octet_length(deletion_token_hash) = 32);
ALTER TABLE questions ADD CONSTRAINT questions_deletion_token_hash_unique UNIQUE (deletion_token_hash);
ALTER TABLE questions ADD CONSTRAINT questions_id_deletion_token_hash_unique UNIQUE (id, deletion_token_hash);

CREATE TABLE question_deletion_tokens (
    question_id BIGINT PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    token_hash BYTEA NOT NULL UNIQUE CHECK (octet_length(token_hash) = 32),
    CONSTRAINT question_deletion_tokens_question_hash_fk
        FOREIGN KEY (question_id, token_hash)
        REFERENCES questions(id, deletion_token_hash) ON DELETE CASCADE
);
CREATE INDEX question_deletion_tokens_user_id_idx ON question_deletion_tokens (user_id);

INSERT INTO question_deletion_tokens (question_id, user_id, token_hash)
SELECT id, author_id, deletion_token_hash FROM questions;
