package com.example.backend;

import java.net.URI;
import java.net.http.*;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = "app.testing-permissions=false")
class PoolApiTests extends PostgresTestSupport {
    @Value("${local.server.port}") int port;
    @Autowired JdbcTemplate jdbc;
    final HttpClient client = HttpClient.newHttpClient();
    final JsonMapper json = JsonMapper.builder().build();
    final String professor = "prof-" + UUID.randomUUID();
    final String student = "student-" + UUID.randomUUID();
    final String peer = "peer-" + UUID.randomUUID();

    @Test
    void completeLectureFlowEnforcesIdentityPrivacyAndModeration() throws Exception {
        assertEquals(401, send("GET", "/lectures", null, null).statusCode());
        assertEquals(201, send("POST", "/lectures", student, "{\"title\":\"Student-owned lecture\",\"lectureTime\":\"2026-10-10T10:00:00Z\"}").statusCode());
        promote(professor);
        var lecture = send("POST", "/lectures", professor, "{\"title\":\"Lecture\",\"lectureTime\":\"2026-10-10T10:00:00Z\"}");
        assertEquals(201, lecture.statusCode());
        start(tree(lecture).get("id").asText());
        String path = "/lectures/" + tree(lecture).get("id").asText() + "/questions";
        assertEquals(400, send("POST", path, student, "{\"text\":\"   \"}").statusCode());
        assertEquals(400, send("POST", path, student, "{\"text\":\"" + "x".repeat(201) + "\"}").statusCode());
        var created = send("POST", path, student, "{\"text\":\" Why? \"}");
        assertEquals(201, created.statusCode());
        assertEquals(200, send("GET", created.headers().firstValue("location").orElseThrow().substring(4), peer, null).statusCode());
        var question = tree(created);
        String id = question.get("id").asText();
        assertEquals("Why?", question.get("text").asText());
        assertTrue(question.get("mine").asBoolean());
        assertFalse(question.has("authorId"));
        assertEquals(201, send("POST", path, student, "{\"text\":\"Another?\"}").statusCode());
        assertEquals(403, send("POST", "/questions/" + id + "/vote", student, "{\"voted\":true}").statusCode());
        assertEquals(400, send("POST", "/questions/" + id + "/vote", peer, "{}").statusCode());
        for (int i = 0; i < 2; i++) {
            var vote = tree(send("POST", "/questions/" + id + "/vote", peer, "{\"voted\":true}"));
            assertEquals(1, vote.get("votes").asLong());
            assertTrue(vote.get("votedByMe").asBoolean());
            assertEquals(204, send("POST", "/questions/" + id + "/report", peer, null).statusCode());
        }
        assertEquals(403, send("GET", path.replace("/questions", "/professor/questions"), student, null).statusCode());
        String outsider = "outsider-" + UUID.randomUUID();
        promote(outsider);
        assertEquals(403, send("GET", path.replace("/questions", "/professor/questions"), outsider, null).statusCode());
        assertEquals(403, send("PATCH", "/questions/" + id + "/status", outsider, "{\"status\":\"answered\"}").statusCode());
        var privateQuestion = tree(send("GET", path.replace("/questions", "/professor/questions"), professor, null)).get(0);
        assertEquals(student, privateQuestion.get("authorId").asText());
        assertEquals(1, privateQuestion.get("reportCount").asLong());
        for (String status : new String[]{"selected", "answered", "open"}) {
            var updated = send("PATCH", "/questions/" + id + "/status", professor, "{\"status\":\"" + status + "\"}");
            assertEquals(200, updated.statusCode());
            assertEquals(status, tree(updated).get("status").asText());
            assertEquals(status.equals("answered"), !tree(updated).get("answeredAt").isNull());
        }
        assertEquals(0, tree(send("POST", "/questions/" + id + "/vote", peer, "{\"voted\":false}")).get("votes").asLong());
        assertEquals(403, send("DELETE", "/questions/" + id, peer, null).statusCode());
        assertEquals(204, send("DELETE", "/questions/" + id, professor, null).statusCode());
        assertEquals(1, tree(send("GET", path, student, null)).size());
        assertEquals(404, send("POST", "/questions/" + id + "/report", peer, null).statusCode());
        assertEquals(201, send("POST", path, student, "{\"text\":\"Another after deletion?\"}").statusCode());
        assertEquals(404, send("GET", "/lectures/9223372036854775807/questions", student, null).statusCode());
        assertEquals(400, send("GET", "/lectures/invalid/questions", student, null).statusCode());
    }

    @Test
    void blockedQuestionsNeverEnterThePoolAndWarningsAccumulateWithoutSavingText() throws Exception {
        promote(professor);
        String lecture = tree(send("POST", "/lectures", professor, "{\"title\":\"Moderation\",\"lectureTime\":\"2026-10-10T11:00:00Z\"}")).get("id").asText();
        start(lecture);
        String path = "/lectures/" + lecture + "/questions";

        for (int count = 1; count <= 2; count++) {
            var rejected = send("POST", path, student, count == 1
                ? "{\"text\":\"What the f.u.c.k?\"}"
                : "{\"text\":\"What the f u c k?\"}");
            assertEquals(422, rejected.statusCode());
            assertEquals("QUESTION_BLOCKED", tree(rejected).get("code").asText());
            assertEquals(count, tree(rejected).get("warningCount").asInt());
            assertEquals(0, tree(send("GET", path, peer, null)).size());
        }
        assertEquals(0L, jdbc.queryForObject("SELECT count(*) FROM questions WHERE lecture_id = ?", Long.class, Long.parseLong(lecture)));
        assertEquals(2L, jdbc.queryForObject("SELECT count(*) FROM question_moderation_warnings WHERE lecture_id = ?", Long.class, Long.parseLong(lecture)));
        var peerWarning = send("POST", path, peer, "{\"text\":\"This is sh!t\"}");
        assertEquals(422, peerWarning.statusCode());
        assertEquals(1, tree(peerWarning).get("warningCount").asInt());
        assertEquals(201, send("POST", path, student, "{\"text\":\"Could you explain the base case?\"}").statusCode());
    }

    @Test
    void ranksVotesFirstAndEarlierQuestionsFirstOnTies() throws Exception {
        promote(professor);
        String lecture = tree(send("POST", "/lectures", professor, "{\"title\":\"Ranking\",\"lectureTime\":\"2026-10-10T11:00:00Z\"}")).get("id").asText();
        start(lecture);
        String path = "/lectures/" + lecture + "/questions";
        String first = tree(send("POST", path, student, "{\"text\":\"Earlier\"}")).get("id").asText();
        String second = tree(send("POST", path, peer, "{\"text\":\"Later\"}")).get("id").asText();
        assertEquals(first, tree(send("GET", path, student, null)).get(0).get("id").asText());
        send("POST", "/questions/" + second + "/vote", student, "{\"voted\":true}");
        assertEquals(second, tree(send("GET", path, student, null)).get(0).get("id").asText());
        send("PATCH", "/questions/" + second + "/status", professor, "{\"status\":\"answered\"}");
        assertEquals(first, tree(send("GET", path, student, null)).get(0).get("id").asText());
    }

    @Test
    void concurrentSubmissionsBothSucceedAndVotesRemainUnique() throws Exception {
        promote(professor);
        String lecture = tree(send("POST", "/lectures", professor, "{\"title\":\"Concurrency\",\"lectureTime\":\"2026-10-10T11:00:00Z\"}")).get("id").asText();
        start(lecture);
        String path = "/lectures/" + lecture + "/questions";
        var a = CompletableFuture.supplyAsync(() -> uncheckedSend("POST", path, student, "{\"text\":\"First?\"}"));
        var b = CompletableFuture.supplyAsync(() -> uncheckedSend("POST", path, student, "{\"text\":\"Second?\"}"));
        assertEquals(201, a.get().statusCode());
        assertEquals(201, b.get().statusCode());
        assertNotEquals(tree(a.get()).get("id").asText(), tree(b.get()).get("id").asText());
        assertEquals(2, tree(send("GET", path, student, null)).size());
        var created = a.get();
        String votePath = "/questions/" + tree(created).get("id").asText() + "/vote";
        var v1 = CompletableFuture.supplyAsync(() -> uncheckedSend("POST", votePath, peer, "{\"voted\":true}"));
        var v2 = CompletableFuture.supplyAsync(() -> uncheckedSend("POST", votePath, peer, "{\"voted\":true}"));
        assertEquals(200, v1.get().statusCode());
        assertEquals(200, v2.get().statusCode());
        assertEquals(1, tree(send("GET", path, peer, null)).get(0).get("votes").asLong());
        String other = tree(send("POST", "/lectures", professor, "{\"title\":\"Separate\",\"lectureTime\":\"2026-10-10T12:00:00Z\"}")).get("id").asText();
        start(other);
        assertEquals(0, tree(send("GET", "/lectures/" + other + "/questions", peer, null)).size());
        assertEquals(201, send("POST", "/lectures/" + other + "/questions", student, "{\"text\":\"Allowed here?\"}").statusCode());
    }
    @Test
    void studentsDeleteOnlyTheirOwnQuestionsAndCanKeepSubmitting() throws Exception {
        promote(professor);
        String lecture = tree(send("POST", "/lectures", professor, "{\"title\":\"Student deletion\",\"lectureTime\":\"2026-10-10T11:00:00Z\"}")).get("id").asText();
        start(lecture);
        String path = "/lectures/" + lecture + "/questions";
        String id = tree(send("POST", path, student, "{\"text\":\"My first question\"}")).get("id").asText();
        assertEquals(201, send("POST", path, student, "{\"text\":\"My second question\"}").statusCode());
        assertEquals(2, tree(send("GET", path, student, null)).size());
        assertEquals(401, send("DELETE", "/questions/" + id, null, null).statusCode());
        assertEquals(403, send("DELETE", "/questions/" + id, peer, null).statusCode());
        assertEquals(200, send("POST", "/questions/" + id + "/vote", peer, "{\"voted\":true}").statusCode());
        assertEquals(204, send("POST", "/questions/" + id + "/report", peer, null).statusCode());
        assertEquals(200, send("PATCH", "/questions/" + id + "/status", professor, "{\"status\":\"answered\"}").statusCode());
        assertEquals(204, send("DELETE", "/questions/" + id, student, null).statusCode());
        assertEquals(404, send("GET", path + "/" + id, student, null).statusCode());
        assertEquals(404, send("DELETE", "/questions/" + id, student, null).statusCode());
        assertEquals(1, tree(send("GET", path, peer, null)).size());
        assertEquals(1, tree(send("GET", "/lectures/" + lecture + "/professor/questions", professor, null)).size());
        assertEquals(0L, jdbc.queryForObject("SELECT count(*) FROM questions WHERE id = ?", Long.class, Long.parseLong(id)));
        assertEquals(0L, jdbc.queryForObject("SELECT count(*) FROM question_votes WHERE question_id = ?", Long.class, Long.parseLong(id)));
        assertEquals(0L, jdbc.queryForObject("SELECT count(*) FROM question_reports WHERE question_id = ?", Long.class, Long.parseLong(id)));
        assertEquals(201, send("POST", path, student, "{\"text\":\"After deletion\"}").statusCode());
    }

    void start(String lecture) throws Exception {
        assertEquals(200, send("PATCH", "/lectures/" + lecture + "/session", professor, "{\"action\":\"start\"}").statusCode());
    }
    void promote(String identity) {
        jdbc.update("INSERT INTO users (eth_identity_ref, role) VALUES (?, 'professor')", identity);
    }
    JsonNode tree(HttpResponse<String> response) { return json.readTree(response.body()); }
    HttpResponse<String> uncheckedSend(String method, String path, String identity, String body) {
        try { return send(method, path, identity, body); }
        catch (Exception error) { throw new RuntimeException(error); }
    }
    HttpResponse<String> send(String method, String path, String identity, String body) throws Exception {
        var request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api" + path))
            .method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(body));
        if (identity != null) request.header("X-User-Id", identity);
        if (body != null) request.header("Content-Type", "application/json");
        return client.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }
}
