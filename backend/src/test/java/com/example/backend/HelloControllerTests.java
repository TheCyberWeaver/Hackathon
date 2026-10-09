package com.example.backend;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = "app.frontend-origin=https://app.example.com")
class HelloControllerTests {
    @Value("${local.server.port}")
    private int port;

    private final HttpClient client = HttpClient.newHttpClient();

    @Test
    void helloReturnsTheExpectedJson() throws Exception {
        var response = send(HttpRequest.newBuilder(endpoint()).GET().build());
        assertEquals(200, response.statusCode());
        assertTrue(response.headers().firstValue("content-type").orElse("").contains("application/json"));
        assertEquals("{\"message\":\"Hello from Java 21\"}", response.body());
    }

    @Test
    void configuredOriginPassesPreflight() throws Exception {
        var response = send(preflight("https://app.example.com"));
        assertEquals(200, response.statusCode());
        assertEquals("https://app.example.com", response.headers().firstValue("access-control-allow-origin").orElse(""));
    }

    @Test
    void unlistedOriginIsRejected() throws Exception {
        var response = send(preflight("https://unlisted.example.com"));
        assertEquals(403, response.statusCode());
        assertTrue(response.headers().firstValue("access-control-allow-origin").isEmpty());
    }

    private URI endpoint() { return URI.create("http://localhost:" + port + "/api/hello"); }

    private HttpRequest preflight(String origin) {
        return HttpRequest.newBuilder(endpoint())
            .header("Origin", origin)
            .header("Access-Control-Request-Method", "GET")
            .method("OPTIONS", HttpRequest.BodyPublishers.noBody()).build();
    }

    private HttpResponse<String> send(HttpRequest request) throws Exception {
        return client.send(request, HttpResponse.BodyHandlers.ofString());
    }
}
