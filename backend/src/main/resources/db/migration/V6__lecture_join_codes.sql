ALTER TABLE lectures ADD COLUMN join_code VARCHAR(32);

-- Existing lectures receive stable, unique codes; new lectures receive random codes.
UPDATE lectures
SET join_code = 'L' || repeat('0', greatest(0, 7 - length(upper(to_hex(id))))) || upper(to_hex(id))
WHERE join_code IS NULL;

ALTER TABLE lectures ALTER COLUMN join_code SET NOT NULL;
-- Preserve compatibility with legacy writers that still insert lectures directly.
ALTER TABLE lectures ALTER COLUMN join_code SET DEFAULT upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
CREATE UNIQUE INDEX lectures_join_code_unique ON lectures (join_code);

CREATE TABLE lecture_memberships (
    user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    lecture_id BIGINT NOT NULL REFERENCES lectures(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX lecture_memberships_lecture_idx ON lecture_memberships (lecture_id);
