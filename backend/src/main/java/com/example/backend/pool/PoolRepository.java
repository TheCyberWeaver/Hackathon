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
    public record QuestionAccess(long id, long lectureId, long authorId, OffsetDateTime deletedAt) {}

    public User user(String identity) {
        jdbc.update("INSERT INTO users (eth_identity_ref) VALUES (?) ON CONFLICT (eth_identity_ref) DO NOTHING", identity);
        return jdbc.queryForObject("SELECT id, role FROM users WHERE eth_identity_ref = ?",
            (rs, row) -> new User(rs.getLong("id"), rs.getString("role")), identity);
    }
    public LectureAccess lecture(long id) {
        return lecture(id, false);
    }
    public LectureAccess lockLecture(long id) { return lecture(id, true); }
    private LectureAccess lecture(long id, boolean lock) {
        return jdbc.query("SELECT id, owner_id, started_at, ended_at, questions_paused FROM lectures WHERE id = ?" + (lock ? " FOR UPDATE" : ""),
            (rs, row) -> new LectureAccess(rs.getLong("id"), rs.getObject("owner_id", Long.class),
                new LectureSession.State(time(rs, "started_at"), time(rs, "ended_at"), rs.getBoolean("questions_paused"))), id)
            .stream().findFirst().orElseThrow(() -> new ApiException(NOT_FOUND, "Lecture not found."));
    }
    public QuestionAccess lockQuestion(long id) {
        return lockQuestion(id, false);
    }
    public QuestionAccess lockQuestion(long id, boolean includeDeleted) {
        return jdbc.query("SELECT id, lecture_id, author_id, deleted_at FROM questions WHERE id = ?" + (includeDeleted ? "" : " AND deleted_at IS NULL") + " FOR UPDATE",
            (rs, row) -> new QuestionAccess(rs.getLong("id"), rs.getLong("lecture_id"), rs.getLong("author_id"), time(rs, "deleted_at")), id)
            .stream().findFirst().orElseThrow(() -> new ApiException(NOT_FOUND, "Question not found."));
    }
    public List<Lecture> lectures(User user) {
        return jdbc.query("SELECT * FROM lectures ORDER BY lecture_time DESC, id DESC",
            (rs, row) -> new Lecture(Long.toString(rs.getLong("id")), rs.getString("title"), time(rs, "lecture_time"),
                user.role().equals("admin") || (user.role().equals("professor") && Long.valueOf(user.id()).equals(rs.getObject("owner_id", Long.class))),
                rs.getString("course"), time(rs, "started_at"), time(rs, "ended_at"), rs.getBoolean("questions_paused")));
    }
    public long createLecture(String title, OffsetDateTime time, long owner, String course) {
        return jdbc.queryForObject("INSERT INTO lectures (title, lecture_time, owner_id, course) VALUES (?, ?, ?, ?) RETURNING id", Long.class, title, time, owner, course);
    }
    public void session(long id, LectureSession.State state) {
        jdbc.update("UPDATE lectures SET started_at = ?, ended_at = ?, questions_paused = ? WHERE id = ?",
            state.startedAt(), state.endedAt(), state.paused(), id);
    }
    public void joinSession(long user, long lecture) {
        jdbc.update("INSERT INTO lecture_memberships (user_id, lecture_id) VALUES (?, ?) ON CONFLICT (user_id) DO UPDATE SET lecture_id = EXCLUDED.lecture_id, joined_at = CURRENT_TIMESTAMP", user, lecture);
    }
    public SharedSession joinedSession(long user) {
        return jdbc.query("SELECT l.id, l.title, l.course, l.started_at FROM lecture_memberships m JOIN lectures l ON l.id = m.lecture_id WHERE m.user_id = ? AND l.started_at IS NOT NULL AND l.ended_at IS NULL",
            (rs, row) -> new SharedSession(Long.toString(rs.getLong("id")), Long.toString(rs.getLong("id")),
                rs.getString("course").isBlank() ? rs.getString("title") : rs.getString("course"), time(rs, "started_at")), user)
            .stream().findFirst().orElse(null);
    }
    public void leaveSession(long user) {
        jdbc.update("DELETE FROM lecture_memberships WHERE user_id = ?", user);
    }
    public void clearLectureMembers(long lecture) {
        jdbc.update("DELETE FROM lecture_memberships WHERE lecture_id = ?", lecture);
    }
    public long createQuestion(long lecture, long author, String text) {
        return jdbc.queryForObject("INSERT INTO questions (lecture_id, author_id, text) VALUES (?, ?, ?) RETURNING id",
            Long.class, lecture, author, text);
    }
    private static final String QUESTION_QUERY = """
        SELECT q.*, u.eth_identity_ref,
            (SELECT count(*) FROM question_votes v WHERE v.question_id = q.id) AS votes,
            EXISTS (SELECT 1 FROM question_votes v WHERE v.question_id = q.id AND v.user_id = ?) AS voted_by_me,
            (SELECT count(*) FROM question_reports r WHERE r.question_id = q.id) AS reports
        FROM questions q JOIN users u ON u.id = q.author_id
        WHERE q.lecture_id = ?
        """;
    private static final String ORDER = " ORDER BY (q.status = 'answered'), votes DESC, q.submitted_at, q.id";
    public List<Question> questions(long lecture, long user) {
        return jdbc.query(QUESTION_QUERY + " AND q.deleted_at IS NULL" + ORDER, (rs, row) -> publicQuestion(rs, user), user, lecture);
    }
    public Question question(long lecture, long id, long user) {
        return jdbc.query(QUESTION_QUERY + " AND q.deleted_at IS NULL AND q.id = ?", (rs, row) -> publicQuestion(rs, user), user, lecture, id)
            .stream().findFirst().orElseThrow(() -> new ApiException(NOT_FOUND, "Question not found."));
    }
    public List<ProfessorQuestion> professorQuestions(long lecture, long user) {
        return professorQuestions(lecture, user, false);
    }
    public List<ProfessorQuestion> professorQuestions(long lecture, long user, boolean includeDeleted) {
        return jdbc.query(QUESTION_QUERY + (includeDeleted ? "" : " AND q.deleted_at IS NULL") + ORDER, (rs, row) -> new ProfessorQuestion(
            Long.toString(rs.getLong("id")), rs.getString("text"), rs.getString("eth_identity_ref"), rs.getLong("votes"),
            time(rs, "submitted_at"), rs.getString("status").equals("answered"), status(rs), time(rs, "answered_at"), rs.getLong("reports"), time(rs, "deleted_at"), rs.getString("answer")), user, lecture);
    }
    public void vote(long question, long user, boolean voted) {
        if (voted) jdbc.update("INSERT INTO question_votes (question_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING", question, user);
        else jdbc.update("DELETE FROM question_votes WHERE question_id = ? AND user_id = ?", question, user);
    }
    public void report(long question, long user) {
        jdbc.update("INSERT INTO question_reports (question_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING", question, user);
    }
    public void status(long question, String status, String answer, boolean answerProvided) {
        jdbc.update("UPDATE questions SET status = ?, selected = ?, answered_at = CASE WHEN ? THEN COALESCE(answered_at, CURRENT_TIMESTAMP) ELSE NULL END, answer = CASE WHEN ? THEN CASE WHEN ? THEN ? ELSE answer END ELSE NULL END WHERE id = ?",
            status.equals("answered") ? "answered" : "unanswered", status.equals("selected"), status.equals("answered"), status.equals("answered"), answerProvided, answer, question);
    }
    public void delete(long question) {
        jdbc.update("UPDATE questions SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?", question);
    }
    public void restore(long question) { jdbc.update("UPDATE questions SET deleted_at = NULL WHERE id = ?", question); }
    public void purge(long question) { jdbc.update("DELETE FROM questions WHERE id = ?", question); }
    public List<Long> lockTrash(long lecture) {
        return jdbc.queryForList("SELECT id FROM questions WHERE lecture_id = ? AND deleted_at IS NOT NULL ORDER BY id FOR UPDATE", Long.class, lecture);
    }
    public Summary summary(User user, boolean all) {
        return jdbc.queryForObject("""
            SELECT count(DISTINCT l.id) AS lectures,
                   count(q.id) FILTER (WHERE q.status = 'unanswered') AS unanswered,
                   count(q.id) FILTER (WHERE q.status = 'answered') AS answered
            FROM lectures l LEFT JOIN questions q ON q.lecture_id = l.id AND q.deleted_at IS NULL
            WHERE ? OR l.owner_id = ?
            """, (rs, row) -> new Summary(rs.getLong("lectures"), rs.getLong("unanswered"), rs.getLong("answered")), all, user.id());
    }
    private static Question publicQuestion(ResultSet rs, long user) throws SQLException {
        return new Question(Long.toString(rs.getLong("id")), rs.getString("text"), rs.getLong("votes"),
            time(rs, "submitted_at"), status(rs), rs.getLong("author_id") == user, rs.getBoolean("voted_by_me"), rs.getString("answer"));
    }
    private static String status(ResultSet rs) throws SQLException {
        return rs.getString("status").equals("answered") ? "answered" : rs.getBoolean("selected") ? "selected" : "open";
    }
    private static OffsetDateTime time(ResultSet rs, String column) throws SQLException {
        return rs.getObject(column, OffsetDateTime.class);
    }
}
