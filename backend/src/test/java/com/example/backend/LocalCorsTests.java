package com.example.backend;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import tools.jackson.databind.json.JsonMapper;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
    "app.frontend-origin=http://localhost:5173,http://127.0.0.1:5173",
    "app.testing-permissions=true"
})
class LocalCorsTests extends PostgresTestSupport {
    @Value("${local.server.port}") int port;
    final HttpClient client = HttpClient.newHttpClient();
    final JsonMapper json = JsonMapper.builder().build();

    @Test void bothLocalBrowserOriginsCanCreateAndStartLectures() throws Exception {
        for (String origin : new String[]{"http://localhost:5173", "http://127.0.0.1:5173"}) {
            var created = send("POST", "/lectures", origin,
                "{\"title\":\"CORS regression\",\"course\":\"Algorithms\",\"lectureTime\":\"2026-10-10T10:00:00Z\"}");
            assertEquals(201, created.statusCode(), created.body());
            assertEquals(origin, created.headers().firstValue("access-control-allow-origin").orElse(""));
            String id = json.readTree(created.body()).get("id").asText();
            var started = send("PATCH", "/lectures/" + id + "/session", origin, "{\"action\":\"start\"}");
            assertEquals(200, started.statusCode(), started.body());
            assertFalse(json.readTree(started.body()).get("startedAt").isNull());
        }
    }

    @Test void localOriginListDoesNotAllowOtherSites() throws Exception {
        var response = send("POST", "/lectures", "https://unlisted.example.com", "{}");
        assertEquals(403, response.statusCode());
        assertEquals("Invalid CORS request", response.body());
    }

    private HttpResponse<String> send(String method, String path, String origin, String body) throws Exception {
        var request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api" + path))
            .header("Origin", origin)
            .header("X-User-Id", "local-cors-test")
            .header("Content-Type", "application/json")
            .method(method, HttpRequest.BodyPublishers.ofString(body)).build();
        return client.send(request, HttpResponse.BodyHandlers.ofString());
    }
}
