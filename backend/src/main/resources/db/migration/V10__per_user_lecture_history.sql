-- Attending a lecture is separate from creating one and from the current room.
CREATE TABLE lecture_history (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lecture_id BIGINT NOT NULL REFERENCES lectures(id) ON DELETE CASCADE,
    first_visited_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_visited_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, lecture_id),
    CHECK (last_visited_at >= first_visited_at)
);
CREATE INDEX lecture_history_user_recent_idx
    ON lecture_history (user_id, last_visited_at DESC, lecture_id DESC);
CREATE INDEX lecture_history_lecture_idx ON lecture_history (lecture_id);
CREATE INDEX lectures_owner_time_idx ON lectures (owner_id, lecture_time DESC, id DESC);

-- Recover only attendance supported by existing data. Earlier visits without a
-- surviving membership, question, vote or report were never recorded.
INSERT INTO lecture_history (user_id, lecture_id, first_visited_at, last_visited_at)
SELECT user_id, lecture_id, min(visited_at), max(visited_at)
FROM (
    SELECT user_id, lecture_id, joined_at AS visited_at FROM lecture_memberships
    UNION ALL
    SELECT author_id, lecture_id, submitted_at FROM questions
    UNION ALL
    SELECT v.user_id, q.lecture_id, q.submitted_at
        FROM question_votes v JOIN questions q ON q.id = v.question_id
    UNION ALL
    SELECT r.user_id, q.lecture_id, r.reported_at
        FROM question_reports r JOIN questions q ON q.id = r.question_id
) attendance
GROUP BY user_id, lecture_id;
