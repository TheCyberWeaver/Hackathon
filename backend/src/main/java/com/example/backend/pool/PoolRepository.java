package com.example.backend.pool;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import static com.example.backend.pool.ApiModels.*;
import static org.springframework.http.HttpStatus.*;

@Repository
public class PoolRepository {
    private final JdbcTemplate jdbc;
    public PoolRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    public record User(long id, String role) {}
    public record LectureAccess(long id, Long ownerId, LectureSession.State session) {}
    public record QuestionAccess(long id, long lectureId, long authorId) {}

    public User user(String identity) {
        jdbc.update("INSERT INTO users (eth_identity_ref) VALUES (?) ON CONFLICT (eth_identity_ref) DO NOTHING", identity);
        return jdbc.queryForObject("SELECT id, role FROM users WHERE eth_identity_ref = ?",
            (rs, row) -> new User(rs.getLong("id"), rs.getString("role")), identity);
    }
    public LectureAccess lecture(long id) {
        return lecture(id, false);
    }
    public LectureAccess lockLecture(long id) { return lecture(id, true); }
    public long lectureIdByCode(String code) {
        return jdbc.query("SELECT id FROM lectures WHERE join_code = ?", (rs, row) -> rs.getLong("id"), code)
            .stream().findFirst().orElseThrow(() -> new ApiException(NOT_FOUND, "Lecture code not found."));
    }
    private LectureAccess lecture(long id, boolean lock) {
        return jdbc.query("SELECT id, owner_id, started_at, ended_at, questions_paused FROM lectures WHERE id = ?" + (lock ? " FOR UPDATE" : ""),
            (rs, row) -> new LectureAccess(rs.getLong("id"), rs.getObject("owner_id", Long.class),
                new LectureSession.State(time(rs, "started_at"), time(rs, "ended_at"), rs.getBoolean("questions_paused"))), id)
            .stream().findFirst().orElseThrow(() -> new ApiException(NOT_FOUND, "Lecture not found."));
    }
    public QuestionAccess lockQuestion(long id) {
        return jdbc.query("SELECT id, lecture_id, author_id FROM questions WHERE id = ? FOR UPDATE",
            (rs, row) -> new QuestionAccess(rs.getLong("id"), rs.getLong("lecture_id"), rs.getLong("author_id")), id)
            .stream().findFirst().orElseThrow(() -> new ApiException(NOT_FOUND, "Question not found."));
    }
    public List<Lecture> lectures(User user) {
        return jdbc.query("""
            SELECT l.*, c.title AS course_name, COALESCE(c.archived, FALSE) AS course_archived FROM lectures l LEFT JOIN professor_courses c ON c.user_id = l.owner_id AND c.id = l.course_id
            WHERE l.owner_id = ?
               OR EXISTS (SELECT 1 FROM lecture_history h WHERE h.user_id = ? AND h.lecture_id = l.id)
               OR EXISTS (SELECT 1 FROM lecture_memberships m WHERE m.user_id = ? AND m.lecture_id = l.id)
            ORDER BY l.lecture_time DESC, l.id DESC
            """, (rs, row) -> lecture(rs, user.id()), user.id(), user.id(), user.id());
    }
    public Lecture lecture(User user, long id) {
        return jdbc.query("SELECT l.*, c.title AS course_name, COALESCE(c.archived, FALSE) AS course_archived FROM lectures l LEFT JOIN professor_courses c ON c.user_id = l.owner_id AND c.id = l.course_id WHERE l.id = ?", (rs, row) -> lecture(rs, user.id()), id)
            .stream().findFirst().orElseThrow(() -> new ApiException(NOT_FOUND, "Lecture not found."));
    }
    private static Lecture lecture(ResultSet rs, long user) throws SQLException {
        return new Lecture(Long.toString(rs.getLong("id")), rs.getString("join_code"), rs.getString("title"), time(rs, "lecture_time"),
            Long.valueOf(user).equals(rs.getObject("owner_id", Long.class)),
            rs.getString("course"), time(rs, "started_at"), time(rs, "ended_at"), rs.getBoolean("questions_paused"),
            rs.getString("course_id") == null ? null : rs.getLong("owner_id") + ":" + rs.getString("course_id"),
            rs.getString("course_name"), rs.getBoolean("course_archived"));
    }
    public List<Lecture> history(User user) {
        return jdbc.query("""
            SELECT l.*, c.title AS course_name, COALESCE(c.archived, FALSE) AS course_archived FROM lecture_history h JOIN lectures l ON l.id = h.lecture_id LEFT JOIN professor_courses c ON c.user_id = l.owner_id AND c.id = l.course_id
            WHERE h.user_id = ? ORDER BY h.last_visited_at DESC, l.id DESC
            """, (rs, row) -> lecture(rs, user.id()), user.id());
    }
    public void recordVisit(long user, long lecture) {
        jdbc.update("""
            INSERT INTO lecture_history (user_id, lecture_id) VALUES (?, ?)
            ON CONFLICT (user_id, lecture_id) DO UPDATE
                SET last_visited_at = GREATEST(lecture_history.last_visited_at, CURRENT_TIMESTAMP)
            """, user, lecture);
    }
    public void forgetVisit(long user, long lecture) {
        jdbc.update("DELETE FROM lecture_history WHERE user_id = ? AND lecture_id = ?", user, lecture);
    }
    public String activeCourseTitle(long owner, String id) {
        // Same profile lock order as profile saves; deletion/rename cannot race creation.
        jdbc.queryForList("SELECT user_id FROM professor_profiles WHERE user_id = ? FOR SHARE", Long.class, owner);
        return jdbc.queryForList("SELECT title FROM professor_courses WHERE user_id = ? AND id = ? AND NOT archived", String.class, owner, id)
            .stream().findFirst().orElseThrow(() -> new ApiException(BAD_REQUEST, "Choose an available course from your Settings."));
    }
    public long createLecture(String title, OffsetDateTime time, long owner, String course, String courseId) {
        for (int attempt = 0; attempt < 100; attempt++) {
            var ids = jdbc.query("""
                INSERT INTO lectures (title, lecture_time, owner_id, course, course_id) VALUES (?, ?, ?, ?, ?)
                ON CONFLICT (join_code) DO NOTHING RETURNING id
                """, (rs, row) -> rs.getLong("id"), title, time, owner, course, courseId);
            if (!ids.isEmpty()) return ids.getFirst();
        }
        throw new ApiException(SERVICE_UNAVAILABLE, "Could not allocate a lecture code. Please try again.");
    }
    public void session(long id, LectureSession.State state) {
        jdbc.update("UPDATE lectures SET started_at = ?, ended_at = ?, questions_paused = ? WHERE id = ?",
            state.startedAt(), state.endedAt(), state.paused(), id);
    }
    public void joinSession(long user, long lecture) {
        jdbc.update("INSERT INTO lecture_memberships (user_id, lecture_id) VALUES (?, ?) ON CONFLICT (user_id) DO UPDATE SET lecture_id = EXCLUDED.lecture_id, joined_at = CURRENT_TIMESTAMP", user, lecture);
    }
    public SharedSession joinedSession(long user) {
        return jdbc.query("SELECT l.id, l.join_code, l.title, l.course, l.started_at FROM lecture_memberships m JOIN lectures l ON l.id = m.lecture_id WHERE m.user_id = ? AND l.started_at IS NOT NULL AND l.ended_at IS NULL",
            (rs, row) -> new SharedSession(Long.toString(rs.getLong("id")), rs.getString("join_code"),
                rs.getString("course").isBlank() ? rs.getString("title") : rs.getString("course"), time(rs, "started_at")), user)
            .stream().findFirst().orElse(null);
    }
    public void leaveSession(long user) {
        jdbc.update("DELETE FROM lecture_memberships WHERE user_id = ?", user);
    }
    public void clearLectureMembers(long lecture) {
        jdbc.update("DELETE FROM lecture_memberships WHERE lecture_id = ?", lecture);
    }
    public long studentCount(long lecture) {
        // Membership is unique per user; history and the lecture owner do not count.
        return jdbc.queryForObject("""
            SELECT count(*) FROM lecture_memberships m
            JOIN lectures l ON l.id = m.lecture_id
            WHERE l.id = ? AND l.started_at IS NOT NULL AND l.ended_at IS NULL
              AND m.user_id <> l.owner_id
            """, Long.class, lecture);
    }
    public long createQuestion(long lecture, long author, String text) {
        return jdbc.queryForObject("INSERT INTO questions (lecture_id, author_id, text) VALUES (?, ?, ?) RETURNING id",
            Long.class, lecture, author, text);
    }
    public long recordModerationWarning(long lecture, long user, String reason) {
        jdbc.update("INSERT INTO question_moderation_warnings (lecture_id, user_id, reason) VALUES (?, ?, ?)", lecture, user, reason);
        return jdbc.queryForObject("SELECT count(*) FROM question_moderation_warnings WHERE lecture_id = ? AND user_id = ?", Long.class, lecture, user);
    }
    // Student-facing reads must never fetch an author's account identity.
    private static final String PUBLIC_QUESTION_QUERY = """
        SELECT q.id, q.text, q.submitted_at, q.status, q.selected,
            q.author_id = ? AS mine,
            (SELECT count(*) FROM question_votes v WHERE v.question_id = q.id) AS votes,
            EXISTS (SELECT 1 FROM question_votes v WHERE v.question_id = q.id AND v.user_id = ?) AS voted_by_me
        FROM questions q
        WHERE q.lecture_id = ?
        """;
    private static final String PROFESSOR_QUESTION_QUERY = """
        SELECT q.id, q.text, q.submitted_at, q.status, q.selected, q.answered_at,
            u.eth_identity_ref,
            (SELECT count(*) FROM question_votes v WHERE v.question_id = q.id) AS votes,
            (SELECT count(*) FROM question_reports r WHERE r.question_id = q.id) AS reports
        FROM questions q
        JOIN lectures l ON l.id = q.lecture_id AND l.owner_id = ?
        JOIN users u ON u.id = q.author_id
        WHERE q.lecture_id = ?
        """;
    private static final String ORDER = " ORDER BY (q.status = 'answered'), votes DESC, q.submitted_at, q.id";
    public List<Question> questions(long lecture, long user) {
        return jdbc.query(PUBLIC_QUESTION_QUERY + ORDER, (rs, row) -> publicQuestion(rs), user, user, lecture);
    }
    public Question question(long lecture, long id, long user) {
        return jdbc.query(PUBLIC_QUESTION_QUERY + " AND q.id = ?", (rs, row) -> publicQuestion(rs), user, user, lecture, id)
            .stream().findFirst().orElseThrow(() -> new ApiException(NOT_FOUND, "Question not found."));
    }
    public List<ProfessorQuestion> professorQuestions(long lecture, long user) {
        return jdbc.query(PROFESSOR_QUESTION_QUERY + ORDER, (rs, row) -> new ProfessorQuestion(
            Long.toString(rs.getLong("id")), rs.getString("text"), rs.getString("eth_identity_ref"), rs.getLong("votes"),
            time(rs, "submitted_at"), rs.getString("status").equals("answered"), status(rs), time(rs, "answered_at"), rs.getLong("reports")), user, lecture);
    }
    public void vote(long question, long user, boolean voted) {
        if (voted) jdbc.update("INSERT INTO question_votes (question_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING", question, user);
        else jdbc.update("DELETE FROM question_votes WHERE question_id = ? AND user_id = ?", question, user);
    }
    public void report(long question, long user) {
        jdbc.update("INSERT INTO question_reports (question_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING", question, user);
    }
    public void status(long question, String status) {
        jdbc.update("UPDATE questions SET status = ?, selected = ?, answered_at = CASE WHEN ? THEN COALESCE(answered_at, CURRENT_TIMESTAMP) ELSE NULL END WHERE id = ?",
            status.equals("answered") ? "answered" : "unanswered", status.equals("selected"), status.equals("answered"), question);
    }
    public void deleteLecture(long lecture) {
        // Restrictive lecture FKs require explicit cleanup; question dependents and
        // personal history/memberships cascade within the service transaction.
        jdbc.update("DELETE FROM questions WHERE lecture_id = ?", lecture);
        jdbc.update("DELETE FROM question_moderation_warnings WHERE lecture_id = ?", lecture);
        jdbc.update("DELETE FROM lectures WHERE id = ?", lecture);
    }
    public void delete(long question) { jdbc.update("DELETE FROM questions WHERE id = ?", question); }
    public List<String> clearOpen(long lecture, List<Long> ids) {
        if (ids.isEmpty()) return List.of();
        // Lock in a consistent order; recheck status after waiting for concurrent status changes.
        // Only the confirmed snapshot is eligible, so later submissions always survive.
        var placeholders = String.join(",", java.util.Collections.nCopies(ids.size(), "?"));
        var args = new java.util.ArrayList<Object>();
        args.add(lecture);
        args.addAll(ids);
        return jdbc.queryForList("DELETE FROM questions WHERE id IN (SELECT id FROM questions WHERE lecture_id = ? AND status = 'unanswered' AND id IN (" + placeholders + ") ORDER BY id FOR UPDATE) RETURNING id::text", String.class, args.toArray());
    }
    public Summary summary(User user) {
        return jdbc.queryForObject("""
            SELECT count(DISTINCT l.id) AS lectures,
                   count(q.id) FILTER (WHERE q.status = 'unanswered') AS unanswered,
                   count(q.id) FILTER (WHERE q.status = 'answered') AS answered
            FROM lectures l LEFT JOIN questions q ON q.lecture_id = l.id
            WHERE l.owner_id = ?
            """, (rs, row) -> new Summary(rs.getLong("lectures"), rs.getLong("unanswered"), rs.getLong("answered")), user.id());
    }
    public StudentSummary studentSummary(User user) {
        return jdbc.queryForObject("""
            SELECT count(*) AS submitted,
                   count(*) FILTER (WHERE status = 'answered') AS answered
            FROM questions
            WHERE author_id = ?
            """, (rs, row) -> new StudentSummary(rs.getLong("submitted"), rs.getLong("answered")), user.id());
    }
    private static Question publicQuestion(ResultSet rs) throws SQLException {
        return new Question(Long.toString(rs.getLong("id")), rs.getString("text"), rs.getLong("votes"),
            time(rs, "submitted_at"), status(rs), rs.getBoolean("mine"), rs.getBoolean("voted_by_me"));
    }
    private static String status(ResultSet rs) throws SQLException {
        return rs.getString("status").equals("answered") ? "answered" : rs.getBoolean("selected") ? "selected" : "open";
    }
    private static OffsetDateTime time(ResultSet rs, String column) throws SQLException {
        return rs.getObject(column, OffsetDateTime.class);
    }
}
