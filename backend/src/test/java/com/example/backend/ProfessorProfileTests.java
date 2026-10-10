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
class ProfessorProfileTests extends PostgresTestSupport {
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

    @Test void concurrentDevicesInitializeOnceAndOnlyOneStaleRevisionCanSave() throws Exception {
        var first = CompletableFuture.supplyAsync(() -> unchecked("POST", "/professor/profile/initialize", owner, profile(true, 0, "[{\"id\":\"a\",\"title\":\"Algebra\"}]")));
        var second = CompletableFuture.supplyAsync(() -> unchecked("POST", "/professor/profile/initialize", owner, profile(false, 0, "[]")));
        assertEquals(200, first.get().statusCode());
        assertEquals(200, second.get().statusCode());
        assertEquals(tree(first.get()), tree(second.get()));
        var saveA = CompletableFuture.supplyAsync(() -> unchecked("PUT", "/professor/profile", owner, profile(true, 0, "[{\"id\":\"a\",\"title\":\"Algebra\"}]")));
        var saveB = CompletableFuture.supplyAsync(() -> unchecked("PUT", "/professor/profile", owner, profile(true, 0, "[{\"id\":\"b\",\"title\":\"Algorithms\"}]")));
        assertEquals(java.util.Set.of(200, 409), java.util.Set.of(saveA.get().statusCode(), saveB.get().statusCode()));
        var saved = tree(send("GET", "/professor/profile", owner, null, 200));
        assertEquals(1, saved.get("revision").asInt());
        assertEquals(1, saved.get("courses").size());
    }

    @Test void emptySkipPersistsAcrossIndependentClientsAndIsolatesAccounts() throws Exception {
        var initial = tree(send("POST", "/professor/profile/initialize", owner, profile(false, 0, "[]"), 200));
        assertFalse(initial.get("onboardingCompleted").asBoolean());
        var skipped = tree(send("PUT", "/professor/profile", owner, profile(true, 0, "[]"), 200));
        assertTrue(skipped.get("onboardingCompleted").asBoolean());
        assertEquals(0, skipped.get("courses").size());
        // A brand-new HTTP client with the same identity loads the database profile.
        var response = HttpClient.newHttpClient().send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/professor/profile"))
            .header("X-User-Id", owner).GET().build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(skipped, tree(response));
        var separate = tree(send("POST", "/professor/profile/initialize", other, profile(false, 0, "[]"), 200));
        assertFalse(separate.get("onboardingCompleted").asBoolean());
        send("GET", "/professor/profile", student, null, 403);
        send("POST", "/professor/profile/initialize", student, profile(false, 0, "[]"), 403);
        send("PUT", "/professor/profile", null, profile(true, 0, "[]"), 401);
    }

    @Test void importsOnlyOnFirstUseAndRejectsStaleDeviceUpdates() throws Exception {
        var imported = tree(send("POST", "/professor/profile/initialize", owner, profile(true, 0, "[{\"id\":\"a\",\"title\":\"  Algebra  \"},{\"id\":\"b\",\"title\":\"Algorithms\"}]"), 200));
        assertTrue(imported.get("onboardingCompleted").asBoolean());
        assertEquals("Algebra", imported.get("courses").get(0).get("title").asText());
        var changed = tree(send("PUT", "/professor/profile", owner, profile(true, 0, "[{\"id\":\"b\",\"title\":\"Algorithms\"},{\"id\":\"a\",\"title\":\"Linear Algebra\"}]"), 200));
        assertEquals("b", changed.get("courses").get(0).get("id").asText());
        send("PUT", "/professor/profile", owner, profile(true, 0, "[]"), 409);
        send("PUT", "/professor/profile", owner, profile(false, 1, "[]"), 200);
        // Browser-local data must never resurrect a removed course or reset completion.
        var loaded = tree(send("POST", "/professor/profile/initialize", owner, profile(true, 0, "[{\"id\":\"a\",\"title\":\"Old local course\"}]"), 200));
        assertTrue(loaded.get("onboardingCompleted").asBoolean());
        assertEquals(0, loaded.get("courses").size());
        assertEquals(2, loaded.get("revision").asInt());
    }

    @Test void validatesTitlesAtomicallyAndCourseEditsPreserveLectureSnapshots() throws Exception {
        var courses = "[{\"id\":\"a\",\"title\":\"Algebra\"}]";
        send("POST", "/professor/profile/initialize", owner, profile(true, 0, courses), 200);
        send("POST", "/professor/profile/initialize", other, profile(true, 0, courses), 200);
        for (String invalid : new String[]{
                "[{\"id\":\"a\",\"title\":\" \"}]",
                "[{\"id\":\"a\",\"title\":\"Algebra\"},{\"id\":\"b\",\"title\":\" ALGEBRA \"}]",
                "[{\"id\":\"a\",\"title\":\"" + "x".repeat(121) + "\"}]"}) {
            send("PUT", "/professor/profile", owner, profile(true, 0, invalid), 400);
        }
        assertEquals("Algebra", tree(send("GET", "/professor/profile", owner, null, 200)).get("courses").get(0).get("title").asText());
        String lecture = create(owner);
        session(lecture, owner, "start", 200);
        String question = submit(lecture, student, "Keep lecture question");
        send("PATCH", "/questions/" + question + "/status", owner, "{\"status\":\"answered\"}", 200);
        send("PUT", "/professor/profile", owner, profile(true, 0, "[{\"id\":\"a\",\"title\":\"Renamed\"}]"), 200);
        send("PUT", "/professor/profile", owner, profile(true, 1, "[]"), 200);
        var active = tree(send("GET", "/lectures/" + lecture, owner, null, 200));
        assertEquals("Stored lecture", active.get("title").asText());
        assertEquals("Algorithms", active.get("course").asText());
        assertTrue(active.get("endedAt").isNull());
        session(lecture, owner, "end", 200);
        var archived = tree(send("GET", "/professor/lectures/archive", owner, null, 200)).get(0);
        assertEquals("Stored lecture", archived.get("lecture").get("title").asText());
        assertTrue(archived.get("questions").get(0).get("answered").asBoolean());
        assertEquals(1, tree(send("GET", "/professor/profile", other, null, 200)).get("courses").size());
    }
    String profile(boolean completed, int revision, String courses) {
        return "{\"onboardingCompleted\":" + completed + ",\"revision\":" + revision + ",\"courses\":" + courses + "}";
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
