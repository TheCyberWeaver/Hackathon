package com.example.backend.pool;

import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;
import static org.junit.jupiter.api.Assertions.*;

class QuestionModeratorTests {
    HttpServer server;
    final AtomicReference<String> body = new AtomicReference<>();
    @AfterEach void stop() { if (server != null) server.stop(0); }

    QuestionModerator stub(int status, String response, long delay, int timeout) throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/moderate", exchange -> {
            body.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            if (delay > 0) {
                try { Thread.sleep(delay); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            }
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            byte[] bytes = response.getBytes(StandardCharsets.UTF_8);
            try {
                exchange.sendResponseHeaders(status, bytes.length);
                exchange.getResponseBody().write(bytes);
            } finally { exchange.close(); }
        });
        server.start();
        return new QuestionModerator("http://127.0.0.1:" + server.getAddress().getPort(), timeout);
    }

    @Test void sendsOnlyQuestionAndHonorsReject() throws Exception {
        var moderator = stub(200, "{\"decision\":\"reject\"}", 0, 800);
        assertFalse(moderator.accepts("What does \"O(n)\" mean?"));
        var sent = JsonMapper.builder().build().readTree(body.get());
        assertEquals(1, sent.size());
        assertEquals("What does \"O(n)\" mean?", sent.get("question").asText());
    }
    @Test void honorsAccept() throws Exception {
        assertTrue(stub(200, "{\"decision\":\"accept\"}", 0, 800).accepts("Explain?"));
    }
    @Test void unavailableServiceAllowsQuestion() throws Exception {
        assertTrue(stub(503, "{}", 0, 800).accepts("Explain?"));
    }
    @Test void malformedResponseAllowsQuestion() throws Exception {
        assertTrue(stub(200, "not json", 0, 800).accepts("Explain?"));
    }
    @Test void unknownDecisionAllowsQuestion() throws Exception {
        assertTrue(stub(200, "{\"decision\":\"maybe\"}", 0, 800).accepts("Explain?"));
    }
    @Test void timeoutAllowsQuestionPromptly() throws Exception {
        var moderator = stub(200, "{\"decision\":\"reject\"}", 500, 100);
        long start = System.nanoTime();
        assertTrue(moderator.accepts("Explain?"));
        assertTrue(System.nanoTime() - start < 1_000_000_000L);
    }
    @Test void emptyUrlDisablesModeration() {
        assertTrue(new QuestionModerator("", 800).accepts("Explain?"));
    }
}
