package com.example.backend;

import java.net.URI;
import java.net.http.*;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = "app.testing-permissions=false")
class LectureFeaturesTests extends PostgresTestSupport {
    @Value("${local.server.port}") int port;
    @Autowired JdbcTemplate jdbc;
    final HttpClient client = HttpClient.newHttpClient();
    final JsonMapper json = JsonMapper.builder().build();
    final String owner = "owner-" + UUID.randomUUID();
    final String other = "other-professor-" + UUID.randomUUID();
    final String student = "student-" + UUID.randomUUID();
    final String peer = "peer-" + UUID.randomUUID();
    @BeforeEach void professors() {
        jdbc.update("INSERT INTO users (eth_identity_ref, role) VALUES (?, 'professor'), (?, 'professor')", owner, other);
    }

    @Test void lifecycleIsSharedIdempotentAndEnforcedPerLecture() throws Exception {
        String lecture = create(owner);
        String path = "/lectures/" + lecture + "/questions";
        assertTrue(tree(send("GET", "/lectures/" + lecture, student, null, 200)).get("startedAt").isNull());
        send("POST", path, student, "{\"text\":\"Before start\"}", 409);
        session(lecture, owner, "pause", 409);
        session(lecture, student, "start", 403);
        session(lecture, other, "start", 403);
        send("PATCH", "/lectures/" + lecture + "/session", null, "{\"action\":\"start\"}", 401);
        session(lecture, owner, "invalid", 400);
        var started = tree(session(lecture, owner, "start", 200)).get("startedAt");
        assertEquals(started, tree(session(lecture, owner, "start", 200)).get("startedAt"));
        submit(lecture, student, "Before pause");
        session(lecture, owner, "pause", 200);
        assertTrue(tree(send("GET", "/lectures/" + lecture, student, null, 200)).get("questionsPaused").asBoolean());
        send("POST", path, student, "{\"text\":\"While paused\"}", 409);
        String independent = create(other);
        session(independent, other, "start", 200);
        submit(independent, student, "Another lecture is open");
        session(lecture, owner, "resume", 200);
        submit(lecture, student, "After resume");
        var ended = tree(session(lecture, owner, "end", 200)).get("endedAt");
        assertEquals(ended, tree(session(lecture, owner, "end", 200)).get("endedAt"));
        assertEquals(started, tree(send("GET", "/lectures/" + lecture, student, null, 200)).get("startedAt"));
        session(lecture, owner, "start", 409);
        session(lecture, owner, "resume", 409);
        send("POST", path, student, "{\"text\":\"After end\"}", 409);
        assertEquals(2, tree(send("GET", path, student, null, 200)).size());
        var archive = tree(send("GET", "/professor/lectures/archive", owner, null, 200));
        assertEquals(1, archive.size());
        assertEquals(lecture, archive.get(0).get("lecture").get("id").asText());
        assertEquals(2, archive.get(0).get("questions").size());
        assertEquals(0, tree(send("GET", "/professor/lectures/archive", other, null, 200)).size());
        assertEquals(0, tree(send("GET", "/professor/lectures/archive", student, null, 200)).size());
    }

    @Test void selectedLecturePersistsPerStudentAndIsClearedOnLeaveOrEnd() throws Exception {
        String first = create(owner);
        String second = create(other);
        String mine = "/sessions/mine";
        send("POST", "/sessions/join", null, "{\"code\":\"" + first + "\"}", 401);
        send("POST", "/sessions/join", owner, "{\"code\":\"" + first + "\"}", 404);
        send("POST", "/sessions/join", student, "{\"code\":\"invalid\"}", 400);
        send("POST", "/sessions/join", student, "{\"code\":\"" + first + "\"}", 404);
        assertTrue(tree(send("GET", mine, student, null, 200)).get("session").isNull());

        session(first, owner, "start", 200);
        session(second, other, "start", 200);
        var joined = tree(send("POST", "/sessions/join", student, "{\"code\":\"" + first + "\"}", 200));
        assertEquals(first, joined.get("id").asText());
        assertEquals(first, joined.get("code").asText());
        assertEquals("Algorithms", joined.get("course").asText());
        assertEquals(first, tree(send("GET", mine, student, null, 200)).get("session").get("id").asText());
        assertTrue(tree(send("GET", mine, peer, null, 200)).get("session").isNull());

        send("POST", "/sessions/join", peer, "{\"code\":\"" + first + "\"}", 200);
        send("POST", "/sessions/join", student, "{\"code\":\"" + second + "\"}", 200);
        assertEquals(second, tree(send("GET", mine, student, null, 200)).get("session").get("id").asText());
        assertEquals(first, tree(send("GET", mine, peer, null, 200)).get("session").get("id").asText());
        send("DELETE", mine, student, null, 204);
        assertTrue(tree(send("GET", mine, student, null, 200)).get("session").isNull());
        send("POST", "/sessions/join", student, "{\"code\":\"" + first + "\"}", 200);
        session(first, owner, "end", 200);
        assertTrue(tree(send("GET", mine, student, null, 200)).get("session").isNull());
        assertTrue(tree(send("GET", mine, peer, null, 200)).get("session").isNull());
        send("POST", "/sessions/join", student, "{\"code\":\"" + first + "\"}", 404);
        assertEquals(0L, jdbc.queryForObject("SELECT count(*) FROM lecture_memberships WHERE lecture_id = ?", Long.class, Long.parseLong(first)));
    }

    @Test void verbalStatusCountsAndArchivePreserveQuestionsWithoutAnswers() throws Exception {
        String lecture = create(owner);
        session(lecture, owner, "start", 200);
        String id = submit(lecture, student, "Explain this step");
        submit(lecture, student, "Another question");
        String status = "/questions/" + id + "/status";
        send("PATCH", status, other, "{\"status\":\"answered\"}", 403);
        var answered = tree(send("PATCH", status, owner, "{\"status\":\"answered\"}", 200));
        assertFalse(answered.has("answer"));
        assertEquals(answered.get("answeredAt"), tree(send("PATCH", status, owner, "{\"status\":\"answered\"}", 200)).get("answeredAt"));
        var publicQuestion = tree(send("GET", "/lectures/" + lecture + "/questions/" + id, peer, null, 200));
        assertFalse(publicQuestion.has("answer"));
        assertFalse(publicQuestion.has("authorId"));
        assertFalse(publicQuestion.has("reportCount"));
        assertEquals("answered", publicQuestion.get("status").asText());
        var summary = tree(send("GET", "/professor/summary", owner, null, 200));
        assertEquals(1, summary.get("lectureCount").asInt());
        assertEquals(1, summary.get("unansweredCount").asInt());
        assertEquals(1, summary.get("answeredCount").asInt());
        assertEquals(0, tree(send("GET", "/professor/summary", other, null, 200)).get("lectureCount").asInt());
        assertEquals(0, tree(send("GET", "/professor/summary", student, null, 200)).get("lectureCount").asInt());
        var reopened = tree(send("PATCH", status, owner, "{\"status\":\"open\"}", 200));
        assertTrue(reopened.get("answeredAt").isNull());
        assertEquals(answered.get("createdAt"), reopened.get("createdAt"));
        send("PATCH", status, owner, "{\"status\":\"answered\"}", 200);
        session(lecture, owner, "end", 200);
        var archive = tree(send("GET", "/professor/lectures/archive", owner, null, 200));
        assertTrue(archive.get(0).get("questions").toString().contains("Explain this step"));
        send("DELETE", "/questions/" + id, owner, null, 404);
        send("DELETE", "/questions/" + id, student, null, 204);
        assertEquals(0, tree(send("GET", "/professor/summary", owner, null, 200)).get("answeredCount").asInt());
        assertEquals(1, tree(send("GET", "/professor/lectures/archive", owner, null, 200)).get(0).get("questions").size());
    }

    @Test void permanentDeletionCascadesAndCannotBeRestored() throws Exception {
        String lecture = create(owner);
        session(lecture, owner, "start", 200);
        String id = submit(lecture, student, "Question to delete");
        send("POST", "/questions/" + id + "/vote", peer, "{\"voted\":true}", 200);
        send("POST", "/questions/" + id + "/report", peer, null, 204);
        send("PATCH", "/questions/" + id + "/status", owner, "{\"status\":\"answered\"}", 200);
        send("DELETE", "/questions/" + id, other, null, 404);
        send("DELETE", "/questions/" + id, peer, null, 404);
        send("DELETE", "/questions/" + id, owner, null, 404);
        send("DELETE", "/questions/" + id, student, null, 204);
        assertEquals(0, tree(send("GET", "/lectures/" + lecture + "/questions", student, null, 200)).size());
        assertEquals(0, tree(send("GET", "/lectures/" + lecture + "/professor/questions?includeDeleted=true", owner, null, 200)).size());
        send("GET", "/lectures/" + lecture + "/questions/" + id, student, null, 404);
        send("POST", "/questions/" + id + "/restore", owner, null, 404);
        for (String table : new String[]{"questions", "question_votes", "question_reports"}) {
            String column = table.equals("questions") ? "id" : "question_id";
            assertEquals(0L, jdbc.queryForObject("SELECT count(*) FROM " + table + " WHERE " + column + " = ?", Long.class, Long.parseLong(id)));
        }
        session(lecture, owner, "end", 200);
        assertEquals(0, tree(send("GET", "/professor/lectures/archive", owner, null, 200)).get(0).get("questions").size());
    }

    @Test void clearOpenUsesConfirmedSnapshotAndPreservesAnsweredOtherLecturesAndPoolState() throws Exception {
        String lecture = create(owner);
        String independent = create(other);
        session(lecture, owner, "start", 200);
        session(independent, other, "start", 200);
        var ids = new java.util.ArrayList<String>();
        for (int i = 0; i < 8; i++) ids.add(submit(lecture, owner, "Open question " + i));
        for (String old : ids.subList(0, 6)) jdbc.update("UPDATE questions SET submitted_at = CURRENT_TIMESTAMP - INTERVAL '1 hour' WHERE id = ?", Long.parseLong(old));
        send("POST", "/questions/" + ids.getFirst() + "/vote", peer, "{\"voted\":true}", 200);
        send("POST", "/questions/" + ids.getFirst() + "/report", peer, null, 204);
        var answered = new java.util.ArrayList<String>();
        for (int i = 0; i < 3; i++) {
            var id = submit(lecture, student, "Answered question " + i);
            answered.add(id);
            send("PATCH", "/questions/" + id + "/status", owner, "{\"status\":\"answered\"}", 200);
        }
        String otherQuestion = submit(independent, student, "Keep other lecture question");
        // An overbroad/stale client snapshot cannot delete another lecture or an answered question.
        var snapshot = new java.util.ArrayList<>(ids);
        snapshot.addAll(answered);
        snapshot.add(otherQuestion);
        String later = submit(lecture, owner, "Submitted after confirmation");
        session(lecture, owner, "pause", 200);
        var body = json.writeValueAsString(java.util.Map.of("questionIds", snapshot));
        var path = "/lectures/" + lecture + "/questions/clear-open";
        send("POST", path, student, body, 403);
        send("POST", path, other, body, 403);
        var result = tree(send("POST", path, owner, body, 200));
        assertEquals(8, result.get("deletedIds").size());
        assertEquals(0, tree(send("POST", path, owner, body, 200)).get("deletedIds").size());
        assertEquals(4, tree(send("GET", "/lectures/" + lecture + "/questions", student, null, 200)).size());
        send("GET", "/lectures/" + lecture + "/questions/" + later, student, null, 200);
        send("GET", "/lectures/" + independent + "/questions/" + otherQuestion, student, null, 200);
        assertEquals(0L, jdbc.queryForObject("SELECT count(*) FROM question_votes WHERE question_id = ?", Long.class, Long.parseLong(ids.getFirst())));
        assertEquals(0L, jdbc.queryForObject("SELECT count(*) FROM question_reports WHERE question_id = ?", Long.class, Long.parseLong(ids.getFirst())));
        var savedLecture = tree(send("GET", "/lectures/" + lecture, owner, null, 200));
        assertTrue(savedLecture.get("questionsPaused").asBoolean());
        assertTrue(savedLecture.get("endedAt").isNull());
        session(lecture, owner, "resume", 200);
        send("POST", path, owner, json.writeValueAsString(java.util.Map.of("questionIds", java.util.List.of(later))), 200);
        assertFalse(tree(send("GET", "/lectures/" + lecture, owner, null, 200)).get("questionsPaused").asBoolean());
    }

    @Test void pausingAndSubmittingConcurrentlyLeavesThePoolClosed() throws Exception {
        String lecture = create(owner);
        session(lecture, owner, "start", 200);
        var submit = CompletableFuture.supplyAsync(() -> unchecked("POST", "/lectures/" + lecture + "/questions", student, "{\"text\":\"Racing the pause\"}"));
        var pause = CompletableFuture.supplyAsync(() -> unchecked("PATCH", "/lectures/" + lecture + "/session", owner, "{\"action\":\"pause\"}"));
        assertEquals(200, pause.get().statusCode());
        assertTrue(submit.get().statusCode() == 201 || submit.get().statusCode() == 409);
        send("POST", "/lectures/" + lecture + "/questions", student, "{\"text\":\"After pause completed\"}", 409);
        assertEquals(submit.get().statusCode() == 201 ? 1 : 0, tree(send("GET", "/lectures/" + lecture + "/questions", student, null, 200)).size());
    }

    String create(String identity) throws Exception {
        return tree(send("POST", "/lectures", identity, "{\"title\":\"Stored lecture\",\"course\":\"Algorithms\",\"lectureTime\":\"2026-10-10T10:00:00Z\"}", 201)).get("id").asText();
    }
    String submit(String lecture, String identity, String text) throws Exception {
        return tree(send("POST", "/lectures/" + lecture + "/questions", identity, json.writeValueAsString(java.util.Map.of("text", text)), 201)).get("id").asText();
    }
    HttpResponse<String> session(String lecture, String identity, String action, int expected) throws Exception {
        return send("PATCH", "/lectures/" + lecture + "/session", identity, json.writeValueAsString(java.util.Map.of("action", action)), expected);
    }
    JsonNode tree(HttpResponse<String> response) { return json.readTree(response.body()); }
    HttpResponse<String> send(String method, String path, String identity, String body, int expected) throws Exception {
        var response = unchecked(method, path, identity, body);
        assertEquals(expected, response.statusCode(), response.body());
        return response;
    }
    HttpResponse<String> unchecked(String method, String path, String identity, String body) {
        try {
            var req = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api" + path))
                .method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(body));
            if (identity != null) req.header("X-User-Id", identity);
            if (body != null) req.header("Content-Type", "application/json");
            return client.send(req.build(), HttpResponse.BodyHandlers.ofString());
        } catch (Exception error) { throw new RuntimeException(error); }
    }
}
