package com.example.backend;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class CurrentUserControllerTests {
    @Value("${local.server.port}")
    private int port;
    private final HttpClient client = HttpClient.newHttpClient();

    @Test
    void missingIdentityDoesNotSignInAsGuest() throws Exception {
        assertEquals(401, send(request().header("X-User-Name", "Professor")).statusCode());
        assertEquals(401, send(request().header("X-User-Id", " ")).statusCode());
    }

    @Test
    void decodesUnicodeNamesAndPreservesPlusSigns() throws Exception {
        var response = send(request().header("X-User-Id", "zoe@ethz.ch")
            .header("X-User-Name", "Zo%C3%AB%20M%C3%BCller+Lee"));
        assertEquals(200, response.statusCode());
        assertEquals("{\"id\":\"zoe@ethz.ch\",\"name\":\"Zoë Müller+Lee\"}", response.body());
        assertEquals("no-store", response.headers().firstValue("cache-control").orElse(""));
        assertFalse(response.body().contains("role"));
    }

    @Test
    void missingOrMalformedNameFallsBackToIdentity() throws Exception {
        var expected = "{\"id\":\"alex@ethz.ch\",\"name\":\"alex@ethz.ch\"}";
        assertEquals(expected, send(request().header("X-User-Id", "alex@ethz.ch")).body());
        assertEquals(expected, send(request().header("X-User-Id", "alex@ethz.ch")
            .header("X-User-Name", "%not-valid")).body());
    }

    private HttpRequest.Builder request() {
        return HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/me")).GET();
    }

    private HttpResponse<String> send(HttpRequest.Builder builder) throws Exception {
        return client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }
}
