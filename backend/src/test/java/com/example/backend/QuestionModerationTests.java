package com.example.backend;

import com.example.backend.pool.QuestionModerator;
import java.net.URI;
import java.net.http.*;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = "app.testing-permissions=true")
class QuestionModerationTests extends PostgresTestSupport {
    @Value("${local.server.port}") int port;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean QuestionModerator moderator;
    final String identity = "moderation-" + UUID.randomUUID();
    final HttpClient http = HttpClient.newHttpClient();

    @BeforeEach void allowByDefault() { when(moderator.accepts(anyString())).thenReturn(true); }

    long lecture(String course) {
        long owner = jdbc.queryForObject("INSERT INTO users (eth_identity_ref, role) VALUES (?, 'professor') RETURNING id", Long.class, "owner-" + UUID.randomUUID());
        return jdbc.queryForObject("INSERT INTO lectures (title, course, lecture_time, owner_id, started_at) VALUES ('Graph traversal', ?, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP) RETURNING id", Long.class, course, owner);
    }
    HttpResponse<String> submit(long lecture) throws Exception {
        return http.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/lectures/" + lecture + "/questions"))
            .header("X-User-Id", identity).header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString("{\"text\":\"  How does BFS work?  \"}")).build(), HttpResponse.BodyHandlers.ofString());
    }
    @Test void rejectionDoesNotPersistEvenWithTestingPermissions() throws Exception {
        long lecture = lecture("Algorithms");
        when(moderator.accepts("How does BFS work?")).thenReturn(false);
        var response = submit(lecture);
        assertEquals(422, response.statusCode());
        assertTrue(response.body().contains("wording that is not allowed"));
        assertTrue(response.body().contains("\"warningCount\":1"));
        assertEquals(0L, jdbc.queryForObject("SELECT count(*) FROM questions WHERE lecture_id = ?", Long.class, lecture));
        assertEquals("moderation_service", jdbc.queryForObject(
            "SELECT reason FROM question_moderation_warnings WHERE lecture_id = ?", String.class, lecture));
    }
    @Test void acceptanceSendsOnlyTrimmedQuestion() throws Exception {
        long lecture = lecture("Algorithms");
        assertEquals(201, submit(lecture).statusCode());
        verify(moderator).accepts("How does BFS work?");
        assertEquals("How does BFS work?", jdbc.queryForObject("SELECT text FROM questions WHERE lecture_id = ?", String.class, lecture));
    }
    @Test void missingCourseDoesNotAffectModeration() throws Exception {
        assertEquals(201, submit(lecture("")).statusCode());
        verify(moderator).accepts("How does BFS work?");
    }
}
