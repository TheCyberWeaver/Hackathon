package com.example.backend;

import java.net.URI;
import java.net.http.*;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = "app.testing-permissions=true")
class TestingPermissionsTests extends PostgresTestSupport {
    @Value("${local.server.port}") int port;
    @Autowired JdbcTemplate jdbc;
    final HttpClient client = HttpClient.newHttpClient();
    final JsonMapper json = JsonMapper.builder().build();

    @Test
    void everyStoredRoleCanSubmitVoteAndManageOtherUsersLectures() throws Exception {
        String owner = "test-owner-" + UUID.randomUUID();
        var lecture = send("POST", "/lectures", owner,
            "{\"title\":\"Testing permissions\",\"lectureTime\":\"2026-10-10T10:00:00Z\"}");
        assertEquals(201, lecture.statusCode(), lecture.body());
        String lectureId = tree(lecture).get("id").asText();
        String path = "/lectures/" + lectureId + "/questions";
        var original = send("POST", path, owner, "{\"text\":\"Can I use both dashboards?\"}");
        assertEquals(201, original.statusCode(), original.body());
        String questionId = tree(original).get("id").asText();

        for (String role : new String[]{"student", "professor", "admin"}) {
            String identity = role + "-testing-" + UUID.randomUUID();
            jdbc.update("INSERT INTO users (eth_identity_ref, role) VALUES (?, ?)", identity, role);
            var ownLecture = send("POST", "/lectures", identity,
                "{\"title\":\"Any user can create\",\"lectureTime\":\"2026-10-10T11:00:00Z\"}");
            assertEquals(201, ownLecture.statusCode(), ownLecture.body());
            assertTrue(tree(send("GET", "/lectures/" + lectureId, identity, null)).get("canManage").asBoolean());
            for (var item : tree(send("GET", "/lectures", identity, null))) assertTrue(item.get("canManage").asBoolean());
            var submitted = send("POST", path, identity, "{\"text\":\"Testing " + role + " submission\"}");
            assertEquals(201, submitted.statusCode(), submitted.body());
            assertFalse(tree(submitted).has("authorId"));
            assertEquals(200, send("POST", "/questions/" + questionId + "/vote", identity, "{\"voted\":true}").statusCode());
            assertEquals(204, send("POST", "/questions/" + questionId + "/report", identity, null).statusCode());
            var privatePool = send("GET", "/lectures/" + lectureId + "/professor/questions", identity, null);
            assertEquals(200, privatePool.statusCode());
            assertTrue(tree(privatePool).get(0).has("authorId"));
            assertEquals(200, send("PATCH", "/questions/" + questionId + "/status", identity, "{\"status\":\"answered\"}").statusCode());
            assertEquals(200, send("PATCH", "/questions/" + questionId + "/status", identity, "{\"status\":\"open\"}").statusCode());
            String ownQuestion = tree(submitted).get("id").asText();
            assertEquals(204, send("DELETE", "/questions/" + ownQuestion, owner, null).statusCode());
            assertEquals(role, jdbc.queryForObject("SELECT role FROM users WHERE eth_identity_ref = ?", String.class, identity));
        }
        assertEquals("student", jdbc.queryForObject("SELECT role FROM users WHERE eth_identity_ref = ?", String.class, owner));
        assertEquals(401, send("POST", path, null, "{\"text\":\"Unsigned\"}").statusCode());
        assertEquals(401, send("GET", "/lectures/" + lectureId + "/professor/questions", null, null).statusCode());
        assertEquals(201, send("POST", path, owner, "{\"text\":\"Multiple questions are allowed\"}").statusCode());
        assertEquals(403, send("POST", "/questions/" + questionId + "/vote", owner, "{\"voted\":true}").statusCode());
    }

    JsonNode tree(HttpResponse<String> response) { return json.readTree(response.body()); }
    HttpResponse<String> send(String method, String path, String identity, String body) throws Exception {
        var request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api" + path))
            .method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(body));
        if (identity != null) request.header("X-User-Id", identity);
        if (body != null) request.header("Content-Type", "application/json");
        return client.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }
}
