package com.example.backend;

import java.net.URI;
import java.net.http.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import static org.junit.jupiter.api.Assertions.*;

abstract class AccountApiTestSupport extends PostgresTestSupport {
    @Value("${local.server.port}") int port;
    @Autowired JdbcTemplate jdbc;
    final HttpClient client = HttpClient.newHttpClient();
    final JsonMapper json = JsonMapper.builder().build();

    String account(String role) {
        String identity = role + "-" + UUID.randomUUID();
        jdbc.update("INSERT INTO users (eth_identity_ref, role) VALUES (?, ?)", identity, role);
        return identity;
    }
    String create(String identity) throws Exception {
        return send("POST", "/lectures", identity,
            "{\"title\":\"Private lecture\",\"course\":\"Algorithms\",\"lectureTime\":\"2026-10-10T10:00:00Z\"}", 201).get("id").asText();
    }
    String submit(String lecture, String identity, String text) throws Exception {
        return send("POST", "/lectures/" + lecture + "/questions", identity,
            json.writeValueAsString(Map.of("text", text)), 201).get("id").asText();
    }
    JsonNode session(String lecture, String identity, String action, int expected) throws Exception {
        return send("PATCH", "/lectures/" + lecture + "/session", identity,
            json.writeValueAsString(Map.of("action", action)), expected);
    }
    JsonNode join(String lecture, String identity) throws Exception {
        return send("POST", "/sessions/join", identity, json.writeValueAsString(Map.of("code", lecture)), 200);
    }
    Set<String> ids(JsonNode lectures) {
        var ids = new HashSet<String>();
        for (var lecture : lectures) assertTrue(ids.add(lecture.get("id").asText()), "Lecture lists must not contain duplicates");
        return ids;
    }
    JsonNode send(String method, String path, String identity, String body, int expected) throws Exception {
        var request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api" + path))
            .method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(body));
        if (identity != null) request.header("X-User-Id", identity);
        if (body != null) request.header("Content-Type", "application/json");
        var response = client.send(request.build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(expected, response.statusCode(), method + " " + path + ": " + response.body());
        return response.body().isBlank() ? null : json.readTree(response.body());
    }
}
