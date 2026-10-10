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
    public record LectureAccess(long id, Long ownerId) {}
    public record QuestionAccess(long id, long lectureId, long authorId) {}

    public User user(String identity) {
        jdbc.update("INSERT INTO users (eth_identity_ref) VALUES (?) ON CONFLICT (eth_identity_ref) DO NOTHING", identity);
        return jdbc.queryForObject("SELECT id, role FROM users WHERE eth_identity_ref = ?",
            (rs, row) -> new User(rs.getLong("id"), rs.getString("role")), identity);
    }
    public LectureAccess lecture(long id) {
        return jdbc.query("SELECT id, owner_id FROM lectures WHERE id = ?",
            (rs, row) -> new LectureAccess(rs.getLong("id"), rs.getObject("owner_id", Long.class)), id)
            .stream().findFirst().orElseThrow(() -> new ApiException(NOT_FOUND, "Lecture not found."));
    }
    public QuestionAccess lockQuestion(long id) {
        return jdbc.query("SELECT id, lecture_id, author_id FROM questions WHERE id = ? AND deleted_at IS NULL FOR UPDATE",
            (rs, row) -> new QuestionAccess(rs.getLong("id"), rs.getLong("lecture_id"), rs.getLong("author_id")), id)
            .stream().findFirst().orElseThrow(() -> new ApiException(NOT_FOUND, "Question not found."));
    }
    public List<Lecture> lectures(User user) {
        return jdbc.query("SELECT id, title, lecture_time, owner_id FROM lectures ORDER BY lecture_time DESC, id DESC",
            (rs, row) -> new Lecture(Long.toString(rs.getLong("id")), rs.getString("title"), time(rs, "lecture_time"),
                user.role().equals("admin") || (user.role().equals("professor") && Long.valueOf(user.id()).equals(rs.getObject("owner_id", Long.class)))));
    }
    public long createLecture(String title, OffsetDateTime time, long owner) {
        return jdbc.queryForObject("INSERT INTO lectures (title, lecture_time, owner_id) VALUES (?, ?, ?) RETURNING id", Long.class, title, time, owner);
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
        WHERE q.lecture_id = ? AND q.deleted_at IS NULL
        """;
    private static final String ORDER = " ORDER BY (q.status = 'answered'), votes DESC, q.submitted_at, q.id";
    public List<Question> questions(long lecture, long user) {
        return jdbc.query(QUESTION_QUERY + ORDER, (rs, row) -> publicQuestion(rs, user), user, lecture);
    }
    public Question question(long lecture, long id, long user) {
        return jdbc.query(QUESTION_QUERY + " AND q.id = ?", (rs, row) -> publicQuestion(rs, user), user, lecture, id)
            .stream().findFirst().orElseThrow(() -> new ApiException(NOT_FOUND, "Question not found."));
    }
    public List<ProfessorQuestion> professorQuestions(long lecture, long user) {
        return jdbc.query(QUESTION_QUERY + ORDER, (rs, row) -> new ProfessorQuestion(
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
    public void delete(long question) {
        jdbc.update("UPDATE questions SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?", question);
    }
    private static Question publicQuestion(ResultSet rs, long user) throws SQLException {
        return new Question(Long.toString(rs.getLong("id")), rs.getString("text"), rs.getLong("votes"),
            time(rs, "submitted_at"), status(rs), rs.getLong("author_id") == user, rs.getBoolean("voted_by_me"));
    }
    private static String status(ResultSet rs) throws SQLException {
        return rs.getString("status").equals("answered") ? "answered" : rs.getBoolean("selected") ? "selected" : "open";
    }
    private static OffsetDateTime time(ResultSet rs, String column) throws SQLException {
        return rs.getObject(column, OffsetDateTime.class);
    }
}
